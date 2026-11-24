const assert = require('node:assert/strict');
const { test } = require('node:test');
const { mkdtemp, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createFileStorage, validatePdf } = require('../src/services/file-storage');
const { createResourceService } = require('../src/services/resource.service');
const { initialVersion, resourceScope, patchVersion } = require('../src/validators/teacher');

const { pdf } = require('./fixtures/teacher-pdf');

const fields = {
  title: 'Fixture', description: 'A description', author_name: 'Example', category: 'Math',
  education_level: 'Primary', resource_type: 'authored_document', rights_basis: 'own_work', access_level: 'restricted'
};

test('validates scope, declarations, complete metadata and HTTPS links without networking', () => {
  assert.deepEqual(resourceScope({ review_scope: 'government' }), { scope: 'government', schoolId: null });
  assert.throws(() => resourceScope({ review_scope: 'school', review_school_id: 1, owner_id: 4 }), { status: 400 });
  assert.throws(() => resourceScope({ review_scope: 'government', published_version_id: 1 }), { status: 400 });
  for (const url of ['http://example.org', 'data:text/plain,foo', 'file:///tmp/file', 'javascript:alert(1)', 'https://a:b@example.org']) {
    assert.throws(() => initialVersion({ ...fields, resource_type: 'external_link', source_url: url }), { status: 400 });
  }
  const linked = initialVersion({ ...fields, resource_type: 'external_link', source_url: 'https://example.invalid/' });
  assert.equal(linked.source_url, 'https://example.invalid/');
  assert.equal(linked.file_path, null);
  assert.throws(() => patchVersion(linked, { resource_type: 'pdf' }), { status: 400 });
  assert.throws(() => patchVersion(fields, { rights_basis: 'unknown', access_level: 'public' }), { status: 400 });
});

test('PDF storage validates structural markers and allocates private immutable references', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'teacher-files-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createFileStorage(directory);
  for (const buffer of [Buffer.from('plain text'), Buffer.from('%PDF-1.4\n%%EOF'), pdf().subarray(0, -10)]) {
    assert.throws(() => validatePdf(buffer), { code: 'INVALID_PDF' });
  }
  const a = await storage.save(pdf('A'));
  const b = await storage.save(pdf('B'));
  assert.notEqual(a, b);
  assert.equal(await storage.exists(a), true);
  assert.equal(await storage.exists('../' + a), false);
  await storage.remove('../' + a);
  assert.deepEqual((await readdir(directory)).sort(), [a, b].sort());
});

test('an upload rolled back by SQL removes its new file; uncertain commits preserve it', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'teacher-recovery-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createFileStorage(directory);
  const version = { ...fields, id: '2', edit_state: 'draft' };
  const resource = { id: '1', publication_status: 'hidden', published_version_id: null };
  const repository = {
    resourceForVersion: async () => resource, lockResource: async () => resource, lockVersion: async () => version
  };
  let rollbacks = 0;
  const db = {
    beginTransaction: async () => {}, rollback: async () => { rollbacks++; }, release() {}
  };
  const pool = { getConnection: async () => db };
  const service = createResourceService(pool, repository, {}, {}, storage);
  repository.updateVersion = async () => { throw new Error('SQL update failed'); };
  await assert.rejects(service.upload('1', '2', pdf()), /SQL update failed/);
  assert.deepEqual(await readdir(directory), []);
  repository.updateVersion = async () => {};
  db.commit = async () => { throw new Error('Connection lost at commit'); };
  await assert.rejects(service.upload('1', '2', pdf()), /Could not confirm database commit/);
  assert.equal((await readdir(directory)).length, 1);
  assert.equal(rollbacks, 2);
});
