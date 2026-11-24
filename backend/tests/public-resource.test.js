const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, rm, symlink, writeFile } = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { publicFilters } = require('../src/validators/public-resource');
const { createPublicResourceService } = require('../src/services/public-resource.service');
const { createFileStorage } = require('../src/services/file-storage');
const { pdf } = require('./fixtures/teacher-pdf');

const base = {
  id: '1', resource_id: '1', version_id: '2', reviewed_version_id: '2', published_version_id: '2',
  administrative_status: 'normal', publication_status: 'published', edit_state: 'submitted', decision: 'approved', access_level: 'public',
  rights_basis: 'official_link', resource_type: 'external_link', file_path: null,
  source_url: 'https://example.invalid/lesson', title: 'Bài học', description: 'Summary', author_name: 'Teacher',
  category: 'Toán', education_level: 'THCS', version_number: 1, created_at: new Date('2026-01-01T00:00:00Z'),
  review_note: 'private note', password_hash: 'private hash'
};

test('Public query validates sort, types, allowed fields and pagination', () => {
  const defaults = publicFilters({});
  assert.equal(defaults.limit, 12);
  assert.equal(defaults.page, 1);
  assert.equal(defaults.sort, 'newest');
  for (const query of [
    { sort: 'title_asc; DROP' }, { sort: ['newest', 'oldest'] }, { page: '0' }, { limit: '51' },
    { search: 'a'.repeat(101) }, { resource_type: 'html' }, { school_id: '4' }, { search: '' }
  ]) {
    assert.throws(() => publicFilters(query), { status: 400 });
  }
});

test('discovery omits invalid publications and returns only safe metadata with exact pagination', async () => {
  const rows = [
    { ...base, publication_status: 'hidden', category: 'Private' },
    { ...base, reviewed_version_id: '42', category: 'Wrong Review' },
    { ...base, resource_id: '42', category: 'Wrong Resource' },
    { ...base, edit_state: 'draft' },
    { ...base, rights_basis: 'unknown' },
    { ...base, source_url: 'javascript:alert(1)' },
    base,
    { ...base, id: '3', resource_id: '3', category: 'toán', education_level: ' \t' },
    { ...base, id: '4', resource_id: '4', resource_type: 'pdf', rights_basis: 'own_work', file_path: 'missing.pdf' }
  ];
  const service = createPublicResourceService({
    scan: async (_filters, visit) => { await visit(rows.slice(0, 4)); await visit(rows.slice(4)); },
    find: async () => base
  }, { hasPublicPdf: async () => false }, 1000);
  const page = await service.list({ limit: '1', page: '2' });
  assert.deepEqual(page.pagination, { page: 2, limit: 1, total: 2, total_pages: 2 });
  assert.equal(page.data[0].id, '3');
  for (const key of ['file_path', 'review_note', 'password_hash', 'version_id', 'owner_id']) {
    assert.equal(key in page.data[0], false);
  }
  const filters = await service.filters({});
  assert.deepEqual(filters, { categories: ['Toán'], education_levels: ['THCS'], resource_types: ['external_link'] });
  assert.deepEqual(await service.external('1', {}), {
    resource_id: '1', resource_type: 'external_link', url: base.source_url, access_method: 'external'
  });
  await assert.rejects(service.external('1', { url: 'https://untrusted.example' }), { status: 400 });
  await assert.rejects(service.file('1', {}), { status: 404 });
});

test('file access closes its descriptor if publication is withdrawn after opening', async () => {
  const row = { ...base, resource_type: 'pdf', rights_basis: 'own_work', file_path: 'private.pdf' };
  let requests = 0;
  let closes = 0;
  const service = createPublicResourceService({
    find: async () => ++requests === 1 ? row : undefined
  }, { openPublicPdf: async () => ({ close: async () => { closes++; } }) }, 1000);
  await assert.rejects(service.file('1', {}), { status: 404 });
  assert.equal(closes, 1);
});

test('private PDF access validates bytes, limits size, and denies traversal', async t => {
  const root = await mkdtemp(join(tmpdir(), 'public-pdf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'private');
  const storage = createFileStorage(directory);
  const content = pdf('public fixture');
  const reference = await storage.save(content);
  const file = await storage.openPublicPdf(reference, content.length);
  assert.equal(file.size, content.length);
  const chunks = [];
  for await (const chunk of file.stream()) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), content);
  assert.equal(await storage.openPublicPdf(reference, content.length - 1), null);
  assert.equal(await storage.openPublicPdf('../' + reference, 1024), null);
  const bad = randomUUID() + '.pdf';
  await writeFile(join(directory, bad), '<html>unsafe</html>');
  assert.equal(await storage.openPublicPdf(bad, 1024), null);

  const target = join(root, 'outside.pdf');
  await writeFile(target, content);
  const link = randomUUID() + '.pdf';
  try {
    await symlink(target, join(directory, link), 'file');
  } catch (error) {
    if (error.code !== 'EPERM') throw error;
    // Windows can restrict file symlinks. Directory junctions still exercise the escape check.
    await symlink(root, join(directory, link), 'junction');
    t.diagnostic('File symlink privilege unavailable; verified a Windows junction instead.');
  }
  assert.equal(await storage.openPublicPdf(link, 1024), null);
  const linkedRoot = join(root, 'linked-private');
  await symlink(directory, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
  const linkedStorage = createFileStorage(linkedRoot);
  assert.equal(await linkedStorage.openPublicPdf(reference, 1024), null);
  await assert.rejects(linkedStorage.save(content), { code: 'STORAGE_UNAVAILABLE' });
});
