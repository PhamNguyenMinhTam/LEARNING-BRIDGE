const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { MySqlSessionStore } = require('../src/repositories/session.store');
const { createUserRepository } = require('../src/repositories/user.repository');
const { createReviewRepository } = require('../src/repositories/review.repository');
const { createPublicResourceRepository } = require('../src/repositories/public-resource.repository');
const { createAuthService } = require('../src/services/auth.service');
const { createReviewService } = require('../src/services/review.service');
const { createPublicResourceService } = require('../src/services/public-resource.service');
const { createFileStorage } = require('../src/services/file-storage');
const { hashPassword } = require('../src/services/credentials');
const { pdf } = require('./fixtures/teacher-pdf');

test('Public API enforces selected Version, access policy and withdrawal on isolated MySQL', {
  skip: process.env.RUN_MYSQL_PUBLIC_TEST !== '1' && 'Enable for an isolated local test schema'
}, async t => {
  const config = loadConfig();
  assert.equal(config.database.host, '127.0.0.1');
  assert.match(config.database.database, /^learning_bridge_(auth|public)_test(?:_[a-z0-9]+)?$/);
  const pool = createDatabasePool(config.database);
  t.after(() => pool.end());
  const directory = await mkdtemp(join(tmpdir(), 'public-integration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const storage = createFileStorage(directory);
  const users = createUserRepository(pool);
  const reviews = createReviewService(pool, createReviewRepository(pool), storage);
  const publicResources = createPublicResourceService(createPublicResourceRepository(pool), storage, 4096);
  const origin = 'http://127.0.0.1:5500';
  const app = createApp({
    nodeEnv: 'test', government: {}, reviews, publicResources,
    auth: { ...config.session, origins: [origin], store: new MySqlSessionStore(pool), auth: createAuthService(users) }
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;

  const password = 'Public test password 🔑';
  const password_hash = await hashPassword(password);
  const government = await users.create({
    full_name: 'Government fixture', email: randomUUID() + '@example.test', password_hash
  }, 'government');
  const teacher = await users.create({
    full_name: 'Teacher fixture', email: randomUUID() + '@example.test', password_hash
  }, 'teacher');

  async function json(response, status) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  }
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ email: government.email, password })
  });
  await json(login, 200);
  const cookie = login.headers.get('set-cookie').split(';', 1)[0];
  function govPost(path, data) {
    return fetch(base + '/api/government/' + path, {
      method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
  const get = path => fetch(base + '/api/public' + path);
  const notFound = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
  const tag = randomUUID().slice(0, 8);
  const content = pdf('authorized public fixture');
  const ref = await storage.save(content);
  const fakePdf = randomUUID() + '.pdf';
  await writeFile(join(directory, fakePdf), '<html>Not a PDF</html>');

  async function resource() {
    const [row] = await pool.execute(`INSERT INTO resources (owner_id, review_scope, created_at)
      VALUES (CAST(? AS UNSIGNED), 'government', '2026-01-02 03:04:05')`, [teacher.id]);
    return String(row.insertId);
  }
  async function version(id, {
    number = 1, title = 'Bài học ' + tag, category = 'Toán ' + tag, level = 'THCS',
    type = 'external_link', url = 'https://example.invalid/course', file = null,
    rights = 'official_link', access = 'public', decision = 'approved', publish = false
  } = {}) {
    const [insert] = await pool.execute(`INSERT INTO resource_versions
      (resource_id, version_number, title, description, author_name, category, education_level, resource_type,
        file_path, source_url, rights_basis, access_level, edit_state)
      VALUES (CAST(? AS UNSIGNED), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, number, title, 'Chương trình ' + tag, 'Đặng Ánh', category, level, type,
      file, url, rights, access, decision ? 'submitted' : 'draft']);
    const versionId = String(insert.insertId);
    let reviewId;
    if (decision) {
      const final = decision !== 'pending';
      const [r] = await pool.execute(`INSERT INTO resource_reviews
        (version_id, reviewer_id, decision, review_note, submitted_at, reviewed_at)
        VALUES (CAST(? AS UNSIGNED), CAST(? AS UNSIGNED), ?, ?, UTC_TIMESTAMP(), IF(?, UTC_TIMESTAMP(), NULL))`,
      [versionId, final ? government.id : null, decision, final ? 'internal fixture note' : null, final ? 1 : 0]);
      reviewId = String(r.insertId);
    }
    if (publish) {
      await pool.execute(`UPDATE resources SET publication_status = 'published', published_version_id = CAST(? AS UNSIGNED)
        WHERE id = CAST(? AS UNSIGNED)`, [versionId, id]);
    }
    return { versionId, reviewId };
  }
  async function add(options) {
    const id = await resource();
    return { id, ...await version(id, options) };
  }

  const publicLink = await add({ publish: true });
  const publicFile = await add({ publish: true, type: 'pdf', file: ref, url: null, rights: 'own_work',
    title: 'Tệp PDF ' + tag, category: 'Ngữ văn ' + tag, level: 'THPT' });
  const pdfOptions = { type: 'pdf', file: ref, url: null, rights: 'own_work' };
  const excluded = [];
  for (const options of [
    { title: 'Draft ' + tag, category: 'Private Draft ' + tag, decision: null, publish: true },
    { title: 'Pending ' + tag, decision: 'pending', publish: true, ...pdfOptions },
    { title: 'Rejected ' + tag, decision: 'rejected', publish: true, ...pdfOptions },
    { title: 'Restricted ' + tag, publish: true, access: 'restricted', ...pdfOptions },
    { title: 'Hidden ' + tag, category: 'Private Hidden ' + tag },
    { title: 'Wrong scheme ' + tag, publish: true, url: 'javascript:alert(1)' },
    { title: 'Missing ' + tag, ...pdfOptions, publish: true, file: randomUUID() + '.pdf' },
    { title: 'Fake ' + tag, ...pdfOptions, publish: true, file: fakePdf },
    { title: 'Traversal ' + tag, ...pdfOptions, publish: true, file: '../' + ref }
  ]) excluded.push(await add(options));
  for (const item of excluded) {
    for (const suffix of ['', '/download', '/preview', '/external-link']) {
      assert.deepEqual(await json(await get('/resources/' + item.id + suffix), 404), notFound);
    }
  }

  const detailResponse = await get('/resources/' + publicLink.id);
  assert.match(detailResponse.headers.get('cache-control'), /no-store/);
  const detail = await json(detailResponse, 200);
  assert.equal(detail.version_number, 1);
  assert.equal(detail.created_at, '2026-01-02T03:04:05.000Z');
  assert.deepEqual(detail.access_methods, ['external']);
  for (const key of ['file_path', 'review_note', 'versions', 'reviewer_id', 'owner_id', 'version_id']) {
    assert.equal(key in detail, false);
  }
  assert.deepEqual(await json(await get('/resources/18446744073709551615'), 404), notFound);
  assert.deepEqual(await json(await get('/resources/' + publicLink.id + '/download'), 404), notFound);
  const external = await json(await get('/resources/' + publicLink.id + '/external-link'), 200);
  assert.equal(external.url, 'https://example.invalid/course');
  await json(await get('/resources/' + publicLink.id + '/external-link?url=https://untrusted.example'), 400);

  const pending = await version(publicLink.id, { number: 2, title: 'Future ' + tag, decision: 'pending' });
  assert.equal((await json(await get('/resources/' + publicLink.id), 200)).version_number, 1);
  await json(await govPost('reviews/' + pending.reviewId + '/reject', { note: 'Fixture rejection' }), 200);
  assert.equal((await json(await get('/resources/' + publicLink.id), 200)).version_number, 1);
  const next = await version(publicLink.id, { number: 3, title: 'Bài học mới ' + tag, decision: 'pending' });
  const approval = await json(await govPost('reviews/' + next.reviewId + '/approve', {}), 200);
  assert.equal(approval.publication_occurred, true);
  assert.equal((await json(await get('/resources/' + publicLink.id), 200)).version_number, 3);
  await assert.rejects(pool.execute(`UPDATE resources SET published_version_id = CAST(? AS UNSIGNED)
    WHERE id = CAST(? AS UNSIGNED)`, [publicFile.versionId, publicLink.id]), { code: 'ER_NO_REFERENCED_ROW_2' });

  for (const term of ['Bai hoc moi ' + tag, 'Chuong trinh ' + tag, 'Đặng Ánh']) {
    const results = await json(await get('/resources?search=' + encodeURIComponent(term)), 200);
    assert.ok(results.data.some(row => row.id === publicLink.id), term);
  }
  const [[accent]] = await pool.execute(`SELECT CONVERT('Đặng Ánh' USING utf8mb4) COLLATE utf8mb4_0900_ai_ci
    LIKE CONVERT('%Dang Anh%' USING utf8mb4) COLLATE utf8mb4_0900_ai_ci AS ascii_d`);
  const ascii = await json(await get('/resources?search=Dang%20Anh'), 200);
  assert.equal(ascii.data.some(row => row.id === publicLink.id), Boolean(accent.ascii_d));
  t.diagnostic('MySQL LIKE for Đặng Ánh vs Dang Anh: ' + accent.ascii_d);

  const combined = await json(await get('/resources?category=' + encodeURIComponent('Toán ' + tag) +
    '&education_level=THCS&resource_type=external_link&search=' + tag + '&limit=1'), 200);
  assert.deepEqual(combined.data.map(row => row.id), [publicLink.id]);
  const empty = await json(await get('/resources?search=' + encodeURIComponent(tag + '%')), 200);
  assert.deepEqual(empty.pagination, { page: 1, limit: 12, total: 0, total_pages: 0 });
  for (const query of ['sort=invalid', 'limit=51', 'page=0', 'search=a&search=b', 'publication_status=hidden']) {
    await json(await get('/resources?' + query), 400);
  }

  // Exercise title and datetime cursors across batch boundaries with equal sort values.
  const batchTag = 'Batch ' + tag;
  for (let index = 0; index < 65; index++) {
    await add({ title: batchTag, category: 'Batch-only ' + tag, level: 'THCS', publish: true });
  }
  for (const sort of ['newest', 'oldest', 'title_asc', 'title_desc']) {
    const page1 = await json(await get('/resources?search=' + encodeURIComponent(batchTag) + '&sort=' + sort + '&limit=50'), 200);
    const page2 = await json(await get('/resources?search=' + encodeURIComponent(batchTag) + '&sort=' + sort + '&limit=50&page=2'), 200);
    const ids = [...page1.data, ...page2.data].map(row => BigInt(row.id));
    assert.equal(new Set(ids).size, 65);
    assert.equal(page1.pagination.total, 65);
    assert.equal(page2.data.length, 15);
    const compare = ['newest', 'title_desc'].includes(sort) ? (a, b) => a > b : (a, b) => a < b;
    assert.ok(ids.slice(1).every((id, index) => compare(ids[index], id)));
  }

  const filters = await json(await get('/filters'), 200);
  assert.ok(filters.categories.includes('Ngữ văn ' + tag));
  assert.ok(filters.education_levels.includes('THPT'));
  assert.ok(filters.resource_types.includes('pdf'));
  assert.ok(filters.categories.every(value => !value.startsWith('Private ')));
  assert.equal(filters.categories.filter(value => value === 'Batch-only ' + tag).length, 1);

  for (const [endpoint, disposition] of [['download', 'attachment'], ['preview', 'inline']]) {
    const response = await get('/resources/' + publicFile.id + '/' + endpoint);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-disposition'), disposition + '; filename="resource-' + publicFile.id + '.pdf"');
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy'), /sandbox/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), content);
  }
  const head = await fetch(base + '/api/public/resources/' + publicFile.id + '/download', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const withdrawn = await json(await govPost('resources/' + publicFile.id + '/withdraw', { reason: 'Fixture withdrawal' }), 200);
  assert.equal(withdrawn.publication_status, 'hidden');
  for (const suffix of ['', '/download', '/preview']) {
    assert.deepEqual(await json(await get('/resources/' + publicFile.id + suffix), 404), notFound);
  }
  const afterWithdrawal = await version(publicFile.id, { ...pdfOptions, number: 2, decision: 'pending' });
  const stillHidden = await json(await govPost('reviews/' + afterWithdrawal.reviewId + '/approve', {}), 200);
  assert.equal(stillHidden.publication_reason, 'HIDDEN_WITH_APPROVAL_HISTORY');
  assert.deepEqual(await json(await get('/resources/' + publicFile.id + '/download'), 404), notFound);
  const afterFilters = await json(await get('/filters'), 200);
  assert.ok(!afterFilters.categories.includes('Ngữ văn ' + tag));
});
