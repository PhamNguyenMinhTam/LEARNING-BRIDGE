const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { MySqlSessionStore } = require('../src/repositories/session.store');
const { createUserRepository } = require('../src/repositories/user.repository');
const { createReviewRepository } = require('../src/repositories/review.repository');
const { createResourceRepository } = require('../src/repositories/resource.repository');
const { createTeacherSchoolRepository } = require('../src/repositories/teacher-school.repository');
const { createAuthService } = require('../src/services/auth.service');
const { createTeacherSchoolService } = require('../src/services/teacher-school.service');
const { createResourceService } = require('../src/services/resource.service');
const { createReviewService } = require('../src/services/review.service');
const { createFileStorage } = require('../src/services/file-storage');
const { hashPassword } = require('../src/services/credentials');
const { pdf } = require('./fixtures/teacher-pdf');

test('School and Government review HTTP workflow on isolated MySQL', {
  skip: process.env.RUN_MYSQL_REVIEW_TEST !== '1' && 'Enable for an isolated local test schema'
}, async t => {
  const config = loadConfig();
  assert.equal(config.database.host, '127.0.0.1');
  assert.match(config.database.database, /^learning_bridge_(auth|review)_test(?:_[a-z0-9]+)?$/);
  const pool = createDatabasePool(config.database);
  t.after(() => pool.end());
  const directory = await mkdtemp(join(tmpdir(), 'review-test-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const storage = createFileStorage(directory);
  const users = createUserRepository(pool);
  const repository = createReviewRepository(pool);
  const resourceRepository = createResourceRepository(pool);
  const associations = createTeacherSchoolRepository(pool);
  const schools = createTeacherSchoolService(pool, associations, resourceRepository);
  const resources = createResourceService(pool, resourceRepository, schools, associations, storage);
  const reviews = createReviewService(pool, repository, storage);
  const origin = 'http://127.0.0.1:5500';
  const app = createApp({
    nodeEnv: 'test', government: {}, reviews,
    teacher: { schools, resources, maxSize: 1024 },
    auth: { ...config.session, origins: [origin], store: new MySqlSessionStore(pool), auth: createAuthService(users) }
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const password = 'Review fixture password 🔑';
  const hash = await hashPassword(password);
  const tag = randomUUID().slice(0, 8);

  async function school(suffix) {
    const [row] = await pool.execute('INSERT INTO schools (school_code, school_name, teacher_id_pattern) VALUES (?, ?, ?)',
      ['RV-' + tag + suffix, 'Review test ' + suffix, '^GV[0-9]{5}$']);
    return String(row.insertId);
  }
  async function actor(role, schoolId = null) {
    const email = randomUUID() + '@example.test';
    const [row] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role, school_id) VALUES (?, ?, ?, ?, CAST(? AS UNSIGNED))',
      [role, email, hash, role, schoolId]);
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert.equal(response.status, 200);
    return { id: String(row.insertId), cookie: response.headers.get('set-cookie').split(';', 1)[0] };
  }

  const schoolA = await school('A');
  const schoolB = await school('B');
  const adminA = await actor('school_admin', schoolA);
  const adminA2 = await actor('school_admin', schoolA);
  const adminB = await actor('school_admin', schoolB);
  const secondReviewer = await actor('school_admin', schoolA);
  const gov = await actor('government');
  const teacher = await actor('teacher');

  function request(path, user, method = 'GET', body, trusted = true) {
    const headers = new Headers();
    if (trusted) headers.set('Origin', origin);
    if (user) headers.set('Cookie', user.cookie);
    const form = body instanceof FormData;
    if (!form) headers.set('Content-Type', 'application/json');
    return fetch(base + '/api/' + path, { method, headers, body: form ? body : JSON.stringify(body) });
  }
  async function json(response, status) {
    const data = await response.json();
    assert.equal(response.status, status, JSON.stringify(data));
    return data;
  }
  const teacherPost = async (path, body, status = 201) =>
    json(await request('teacher/' + path, teacher, 'POST', body), status);
  const reviewPath = (scope, id) => scope + '/reviews/' + id;
  async function decide(scope, id, action, user, status = 200, body) {
    return json(await request(reviewPath(scope, id) + '/' + action, user, 'POST', body), status);
  }
  const draft = {
    title: 'Lessons ' + tag, description: 'Fixture', category: 'Math', education_level: 'Primary',
    review_scope: 'government', resource_type: 'external_link', rights_basis: 'official_link',
    access_level: 'public', source_url: 'https://example.invalid/official'
  };
  const schoolDraft = { ...draft, review_scope: 'school', review_school_id: schoolA };
  const submit = row => teacherPost('versions/' + row.version_id + '/submit');
  const revised = row => teacherPost('resources/' + row.resource_id + '/versions', {});

  await teacherPost('schools', { school_id: schoolA, teacher_code: 'GV00001' });
  await teacherPost('schools', { school_id: schoolB, teacher_code: 'GV00002' });
  const resource = await teacherPost('resources', schoolDraft);
  const pending = await submit(resource);
  const otherSchool = await submit(await teacherPost('resources', { ...schoolDraft, review_school_id: schoolB }));
  const independent = await submit(await teacherPost('resources', draft));
  const schoolDetail = reviewPath('school', pending.review_id);
  const governmentDetail = reviewPath('government', independent.review_id);

  await json(await request('school/reviews/pending', null), 401);
  await json(await request('school/reviews/pending', gov), 403);
  await json(await request('government/reviews/pending', teacher), 403);
  await json(await request('government/reviews/pending', adminA), 403);
  await json(await request(schoolDetail, adminB), 404);
  await json(await request(schoolDetail + '/approve', adminA, 'POST', {}, false), 403);
  await decide('school', otherSchool.review_id, 'approve', adminA, 404);
  await decide('government', pending.review_id, 'approve', gov, 404);
  await json(await request('school/reviews/pending?school_id=' + schoolB, adminA), 400);
  const queue = await json(await request('school/reviews/pending?limit=1&search=' + tag, adminA), 200);
  assert.deepEqual(queue.pagination, { page: 1, limit: 1, total: 1 });
  assert.equal(queue.data[0].review_id, pending.review_id);
  const govQueue = await json(await request('government/reviews/pending?search=' + tag, gov), 200);
  assert.deepEqual(govQueue.data.map(item => item.review_id), [independent.review_id]);
  const details = await json(await request(schoolDetail, adminA), 200);
  assert.equal(details.version_id, resource.version_id);
  assert.equal('file_path' in details, false);
  assert.equal(details.source_url, draft.source_url);
  assert.deepEqual(details.history, []);

  await pool.execute("UPDATE schools SET status = 'suspended' WHERE id = CAST(? AS UNSIGNED)", [schoolA]);
  await decide('school', pending.review_id, 'approve', adminA, 403);
  await json(await request('school/reviews/pending', adminA), 403);
  await pool.execute("UPDATE schools SET status = 'active' WHERE id = CAST(? AS UNSIGNED)", [schoolA]);
  await pool.execute("UPDATE users SET status = 'suspended' WHERE id = CAST(? AS UNSIGNED)", [adminA2.id]);
  await decide('school', pending.review_id, 'approve', adminA2, 401);
  await decide('school', pending.review_id, 'reject', adminA, 400);
  await decide('school', pending.review_id, 'reject', adminA, 400, { note: '  ' });
  const approvals = await Promise.all([request(schoolDetail + '/approve', adminA, 'POST', {}),
    request(schoolDetail + '/approve', secondReviewer, 'POST', {})]);
  assert.deepEqual(approvals.map(r => r.status).sort(), [200, 409]);
  const approved = await approvals.find(r => r.status === 200).json();
  assert.ok([adminA.id, secondReviewer.id].includes(approved.reviewer_id));
  assert.ok(approved.reviewed_at);
  assert.equal(approved.publication_occurred, true);
  assert.equal(approved.published_version_id, resource.version_id);
  await decide('school', pending.review_id, 'approve', adminA, 409);
  await decide('government', independent.review_id, 'reject', gov, 400);
  assert.equal((await decide('government', independent.review_id, 'approve', gov)).publication_occurred, true);
  await json(await request(governmentDetail + '/preview', gov), 404);

  const restricted = await revised(resource);
  await json(await request('teacher/versions/' + restricted.version_id, teacher, 'PATCH', { access_level: 'restricted' }), 200);
  const restrictedReview = await submit(restricted);
  const kept = await decide('school', restrictedReview.review_id, 'approve', adminA);
  assert.equal(kept.publication_reason, 'ACCESS_RESTRICTED');
  assert.equal(kept.published_version_id, resource.version_id);

  const toReject = await revised(resource);
  const rejection = await submit(toReject);
  const rejected = await decide('school', rejection.review_id, 'reject', adminA, 200, { note: '  Needs more context  ' });
  assert.equal(rejected.review_note, 'Needs more context');
  assert.equal(rejected.published_version_id, resource.version_id);
  await decide('school', rejection.review_id, 'approve', adminA, 409);
  await json(await request('teacher/versions/' + toReject.version_id, teacher, 'PATCH', { title: 'No' }), 409);
  await pool.execute("UPDATE schools SET status = 'suspended' WHERE id = CAST(? AS UNSIGNED)", [schoolA]);
  const history = await json(await request('school/reviews/history?limit=1&decision=rejected&from=2020-01-01', adminA), 200);
  assert.deepEqual(history.data.map(item => item.review_id), [rejection.review_id]);
  assert.equal((await json(await request(schoolDetail, adminA), 200)).publication_status, 'published');
  await pool.execute("UPDATE schools SET status = 'active' WHERE id = CAST(? AS UNSIGNED)", [schoolA]);

  const replacement = await revised(resource);
  await json(await request('teacher/versions/' + replacement.version_id, teacher, 'PATCH', { access_level: 'public' }), 200);
  const replacementReview = await submit(replacement);
  assert.equal((await decide('school', replacementReview.review_id, 'approve', adminA)).published_version_id, replacement.version_id);
  const withdrawPath = 'government/resources/' + resource.resource_id + '/withdraw';
  await json(await request(withdrawPath, gov, 'POST', { reason: ' ' }), 400);
  const withdrawn = await json(await request(withdrawPath, gov, 'POST', { reason: 'Rights expired' }), 200);
  assert.equal(withdrawn.withdrawn_version_id, replacement.version_id);
  assert.equal(withdrawn.reason_recorded, true);
  assert.equal(withdrawn.published_version_id, replacement.version_id);
  const afterWithdrawal = await revised(resource);
  const blocked = await decide('school', (await submit(afterWithdrawal)).review_id, 'approve', adminA);
  assert.equal(blocked.publication_reason, 'ADMINISTRATIVE_HOLD');
  assert.equal(blocked.publication_status, 'hidden');
  const [[publicRow]] = await pool.execute(`SELECT id FROM resources WHERE id = CAST(? AS UNSIGNED)
    AND publication_status = 'published' AND published_version_id IS NOT NULL`, [resource.resource_id]);
  assert.equal(publicRow, undefined);
  const teacherHistory = await json(await request('teacher/resources/' + resource.resource_id + '/reviews', teacher), 200);
  assert.equal(teacherHistory.length, 5);

  const initiallyRestricted = await teacherPost('resources', { ...draft, access_level: 'restricted' });
  const hiddenApproval = await decide('government', (await submit(initiallyRestricted)).review_id, 'approve', gov);
  assert.equal(hiddenApproval.publication_status, 'hidden');
  const eventuallyPublic = await revised(initiallyRestricted);
  await json(await request('teacher/versions/' + eventuallyPublic.version_id, teacher, 'PATCH', { access_level: 'public' }), 200);
  const newlyPublished = await decide('government', (await submit(eventuallyPublic)).review_id, 'approve', gov);
  assert.equal(newlyPublished.publication_reason, null);

  const file = await teacherPost('resources', { ...draft, resource_type: 'authored_document',
    rights_basis: 'own_work', source_url: null });
  const content = pdf('review fixture');
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), '../review.pdf');
  await teacherPost('versions/' + file.version_id + '/upload', form, 200);
  const fileSubmission = await submit(file);
  const preview = reviewPath('government', fileSubmission.review_id) + '/preview';
  await json(await request(preview, null), 401);
  await json(await request(reviewPath('school', fileSubmission.review_id) + '/preview', adminA), 404);
  const filePreview = await request(preview, gov);
  assert.equal(filePreview.status, 200);
  assert.equal(filePreview.headers.get('content-type'), 'application/pdf');
  assert.match(filePreview.headers.get('content-disposition'), /^attachment/);
  assert.match(filePreview.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Buffer.from(await filePreview.arrayBuffer()), content);

  const path = reviewPath('government', fileSubmission.review_id);
  const mixed = await Promise.all([request(path + '/approve', gov, 'POST', {}),
    request(path + '/reject', gov, 'POST', { note: 'Race' })]);
  assert.deepEqual(mixed.map(r => r.status).sort(), [200, 409]);
  const winner = await mixed.find(r => r.status === 200).json();
  assert.equal(winner.publication_occurred, winner.decision === 'approved');
  assert.equal((await json(await request(path, gov), 200)).decision, winner.decision);

  const rollbackResource = await teacherPost('resources', draft);
  const rollbackReview = await submit(rollbackResource);
  const publish = repository.publish;
  repository.publish = async () => { throw new Error('Injected failure after recording decision'); };
  try {
    await decide('government', rollbackReview.review_id, 'approve', gov, 500);
  } finally {
    repository.publish = publish;
  }
  const rolledBack = await json(await request(reviewPath('government', rollbackReview.review_id), gov), 200);
  assert.equal(rolledBack.decision, 'pending');
  assert.equal(rolledBack.published_version_id, null);

  // A legacy Draft beside a Pending Review lets us exercise the shared lock protocol.
  const [legacy] = await pool.execute(`INSERT INTO resource_versions
    (resource_id, version_number, title, description, author_name, category, education_level,
      resource_type, source_url, rights_basis, access_level)
    SELECT resource_id, 2, title, description, author_name, category, education_level, resource_type,
      source_url, rights_basis, access_level FROM resource_versions WHERE id = CAST(? AS UNSIGNED)`,
  [rollbackResource.version_id]);
  const [decision, newSubmission] = await Promise.all([
    request(reviewPath('government', rollbackReview.review_id) + '/reject', gov, 'POST', { note: 'Reviewed' }),
    request('teacher/versions/' + legacy.insertId + '/submit', teacher, 'POST')
  ]);
  assert.equal(decision.status, 200);
  assert.ok([201, 409].includes(newSubmission.status));
  const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM resource_reviews rv
    JOIN resource_versions v ON rv.version_id = v.id WHERE v.resource_id = CAST(? AS UNSIGNED)
    AND rv.decision = 'pending'`, [rollbackResource.resource_id]);
  assert.equal(Number(count.total), newSubmission.status === 201 ? 1 : 0);
});
