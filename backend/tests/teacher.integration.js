const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { mkdtemp, readdir, readFile, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { MySqlSessionStore } = require('../src/repositories/session.store');
const { createUserRepository } = require('../src/repositories/user.repository');
const { createResourceRepository } = require('../src/repositories/resource.repository');
const { createTeacherSchoolRepository } = require('../src/repositories/teacher-school.repository');
const { createAuthService } = require('../src/services/auth.service');
const { createTeacherSchoolService } = require('../src/services/teacher-school.service');
const { createResourceService } = require('../src/services/resource.service');
const { createFileStorage } = require('../src/services/file-storage');
const { hashPassword } = require('../src/services/credentials');
const { pdf } = require('./fixtures/teacher-pdf');

const origin = 'http://127.0.0.1:5500';
const password = 'Mật khẩu thử nghiệm 🔑';

test('Teacher HTTP workflow on isolated MySQL enforces ownership, files, locks and review history', {
  skip: process.env.RUN_MYSQL_TEACHER_TEST !== '1' && 'Enable for an isolated local test schema'
}, async t => {
  const config = loadConfig();
  assert.equal(config.database.host, '127.0.0.1');
  assert.match(config.database.database, /^learning_bridge_(auth|teacher)_test(?:_[a-z0-9]+)?$/);
  const pool = createDatabasePool(config.database);
  t.after(() => pool.end());
  const directory = await mkdtemp(join(tmpdir(), 'teacher-integration-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const userRepository = createUserRepository(pool);
  const resourceRepository = createResourceRepository(pool);
  const associations = createTeacherSchoolRepository(pool);
  const schools = createTeacherSchoolService(pool, associations, resourceRepository);
  const resources = createResourceService(pool, resourceRepository, schools, associations, createFileStorage(directory));
  const app = createApp({
    nodeEnv: 'test',
    auth: { ...config.session, origins: [origin], store: new MySqlSessionStore(pool), auth: createAuthService(userRepository) },
    teacher: { schools, resources, maxSize: 1024 }
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;

  async function data(response, status) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  }

  const hash = await hashPassword(password);
  async function provision(role, schoolId = null) {
    const email = randomUUID() + '@example.test';
    const [insert] = await pool.execute(
      'INSERT INTO users (full_name, email, password_hash, role, school_id) VALUES (?, ?, ?, ?, CAST(? AS UNSIGNED))',
      [role, email, hash, role, schoolId]
    );
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    await data(response, 200);
    return { id: String(insert.insertId), cookie: response.headers.get('set-cookie').split(';', 1)[0] };
  }

  async function schoolFixture(status = 'active') {
    const [result] = await pool.execute(
      'INSERT INTO schools (school_code, school_name, teacher_id_pattern, status) VALUES (?, ?, ?, ?)',
      ['T-' + randomUUID().slice(0, 12), 'Teacher fixture school', '^GV[0-9]{5}$', status]
    );
    return String(result.insertId);
  }

  const school1 = await schoolFixture();
  const school2 = await schoolFixture();
  const suspendedSchool = await schoolFixture('suspended');
  const teacher = await provision('teacher');
  const other = await provision('teacher');
  const government = await provision('government');
  const schoolAdmin = await provision('school_admin', school1);

  function request(path, method = 'GET', body, actor = teacher, requestOrigin = origin) {
    const headers = new Headers();
    if (actor) headers.set('Cookie', actor.cookie);
    if (requestOrigin) headers.set('Origin', requestOrigin);
    const multipart = body instanceof FormData;
    if (!multipart) headers.set('Content-Type', 'application/json');
    return fetch(base + '/api/teacher' + path, {
      method, headers, body: multipart ? body : JSON.stringify(body)
    });
  }
  async function get(path, status = 200, actor) {
    return data(await request(path, 'GET', undefined, actor), status);
  }
  async function post(path, body, status = 201, actor, requestOrigin) {
    return data(await request(path, 'POST', body, actor, requestOrigin), status);
  }
  async function patch(path, body, status = 200, actor) {
    return data(await request(path, 'PATCH', body, actor), status);
  }

  const versionPath = row => '/versions/' + row.version_id;
  const resourcePath = row => '/resources/' + row.resource_id;
  function upload(row, content, status = 200, actor = teacher, fileName = '../../outside.pdf') {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'application/pdf' }), fileName);
    return post(versionPath(row) + '/upload', form, status, actor);
  }
  const submit = (row, status = 201, actor) => post(versionPath(row) + '/submit', undefined, status, actor);
  const fields = {
    title: 'Teacher fixture', description: 'A description', education_level: 'Primary', category: 'Math',
    resource_type: 'external_link', source_url: 'https://example.invalid/teacher', rights_basis: 'official_link',
    access_level: 'public', review_scope: 'government'
  };

  await get('/profile', 401, null);
  await get('/profile', 403, schoolAdmin);
  await get('/profile', 403, government);
  const profile = await get('/profile');
  assert.equal(profile.id, teacher.id);
  assert.ok(profile.created_at);
  assert.equal('password_hash' in profile, false);
  await post('/resources', fields, 403, teacher, null);

  const active = await get('/schools/available');
  assert.ok(active.some(row => row.id === school1));
  assert.ok(!active.some(row => row.id === suspendedSchool));
  assert.deepEqual(Object.keys(active[0]).sort(), ['id', 'school_code', 'school_name']);
  await post('/schools', { school_id: school1, teacher_code: 'WRONG' }, 400);
  await post('/schools', { school_id: suspendedSchool, teacher_code: 'GV00123' }, 409);
  const schoolFields = { ...fields, review_scope: 'school', review_school_id: school1 };
  await post('/resources', schoolFields, 409);
  const a = await post('/schools', { school_id: school1, teacher_code: 'GV00123' });
  await post('/schools', { school_id: school1, teacher_code: 'GV00123' }, 409);
  await post('/schools', { school_id: school2, teacher_code: 'GV00456' });
  assert.equal((await get('/schools')).length, 2);
  const associationPath = '/schools/' + a.association_id + '/status';
  await patch(associationPath, { status: 'inactive' }, 404, other);

  const schoolResource = await post('/resources', schoolFields);
  assert.equal(schoolResource.version_number, 1);
  assert.equal(schoolResource.publication_status, 'hidden');
  await patch(associationPath, { status: 'inactive' });
  await submit(schoolResource, 409);
  const reactivated = await post('/schools', { school_id: school1, teacher_code: 'GV00124' }, 200);
  assert.equal(reactivated.association_id, a.association_id);
  await pool.execute("UPDATE schools SET teacher_id_pattern = '^T[0-9]{6}$' WHERE id = CAST(? AS UNSIGNED)", [school1]);
  assert.equal((await submit(schoolResource, 409)).error.code, 'TEACHER_CODE_MISMATCH');
  await patch(associationPath, { status: 'inactive' });
  await patch(associationPath, { status: 'active' }, 409);
  await post('/schools', { school_id: school1, teacher_code: 'T000001' }, 200);
  await submit(schoolResource);
  await patch(associationPath, { status: 'inactive' });
  assert.equal((await get(resourcePath(schoolResource) + '/reviews'))[0].decision, 'pending');

  await post('/resources', { ...fields, published_version_id: '1' }, 400);
  await post('/resources', { ...fields, source_url: 'file:///etc/passwd' }, 400);
  const independent = await post('/resources', fields);
  assert.equal((await get(resourcePath(independent))).review_scope, 'government');
  assert.deepEqual(await get(resourcePath(independent) + '/reviews'), []);
  await get(resourcePath(independent), 404, other);
  await get(resourcePath(independent) + '/reviews', 404, other);
  await submit(independent, 404, other);
  await patch(versionPath(independent), { title: 'Denied' }, 404, other);
  await patch(versionPath(independent), { resource_id: '1' }, 400);
  assert.equal((await patch(versionPath(independent), { title: 'Updated title' })).title, 'Updated title');
  const view = await get('/resources?review_scope=government&publication_status=hidden&limit=1');
  assert.equal(view.data[0].title, 'Updated title');

  const fileFields = { ...fields, resource_type: 'authored_document', source_url: null, rights_basis: 'own_work' };
  const fileResource = await post('/resources', fileFields);
  await submit(fileResource, 400);
  await upload(fileResource, Buffer.from('not PDF'), 400);
  await upload(fileResource, Buffer.alloc(1025), 413);
  await upload(fileResource, pdf(), 404, other);
  const uploaded = await upload(fileResource, pdf('first'));
  assert.equal(uploaded.has_file, true);
  assert.equal('file_path' in uploaded, false);
  const [oldFile] = await readdir(directory);
  assert.match(oldFile, /^[a-f0-9-]+\.pdf$/);
  const firstReview = await submit(fileResource);
  assert.equal(firstReview.decision, 'pending');
  await submit(fileResource, 409);
  await upload(fileResource, pdf(), 409);
  await patch(versionPath(fileResource), { title: 'Immutable' }, 409);
  await post(resourcePath(fileResource) + '/versions', {}, 409);
  let history = await get(resourcePath(fileResource) + '/reviews');
  assert.equal(history[0].reviewer_name, null);
  assert.equal(history[0].published, false);

  // Fixture-only reviewer decisions prepare states produced by the next phase.
  async function decide(reviewId, decision, note = null) {
    await pool.execute(`UPDATE resource_reviews SET decision = ?, reviewer_id = CAST(? AS UNSIGNED),
      reviewed_at = GREATEST(submitted_at, UTC_TIMESTAMP()), review_note = ? WHERE id = CAST(? AS UNSIGNED)`,
    [decision, government.id, note, reviewId]);
  }

  await decide(firstReview.review_id, 'approved');
  history = await get(resourcePath(fileResource) + '/reviews');
  assert.equal(history[0].decision, 'approved');
  assert.equal(history[0].published, false);
  await pool.execute(`UPDATE resources SET publication_status = 'published', published_version_id = CAST(? AS UNSIGNED)
    WHERE id = CAST(? AS UNSIGNED)`, [fileResource.version_id, fileResource.resource_id]);
  const copies = await Promise.all([request(resourcePath(fileResource) + '/versions', 'POST', {}),
    request(resourcePath(fileResource) + '/versions', 'POST', {})]);
  assert.deepEqual(copies.map(response => response.status).sort(), [201, 409]);
  const second = await copies.find(response => response.status === 201).json();
  assert.equal(second.version_number, 2);
  assert.equal((await get(resourcePath(fileResource))).versions[0].has_file, true);
  await upload(second, pdf('second'));
  assert.deepEqual(await readFile(join(directory, oldFile)), pdf('first'));
  assert.equal((await readdir(directory)).length, 2);
  const submissions = await Promise.all([request(versionPath(second) + '/submit', 'POST'),
    request(versionPath(second) + '/submit', 'POST')]);
  assert.deepEqual(submissions.map(response => response.status).sort(), [201, 409]);
  const secondReview = await submissions.find(response => response.status === 201).json();
  const detail = await get(resourcePath(fileResource));
  assert.equal(detail.published_version_id, fileResource.version_id);
  assert.equal(detail.publication_status, 'published');
  assert.ok(detail.versions.every(version => !('file_path' in version)));
  assert.equal(detail.versions.find(version => version.id === fileResource.version_id).published, true);
  await decide(secondReview.review_id, 'rejected', 'Revision requested');
  assert.equal((await get(resourcePath(fileResource) + '/reviews'))[0].review_note, 'Revision requested');
  const third = await post(resourcePath(fileResource) + '/versions', { source_version_id: fileResource.version_id });
  assert.equal(third.version_number, 3);
  assert.deepEqual(await readFile(join(directory, oldFile)), pdf('first'));

  // Force a duplicate review at INSERT after UPDATE; SQL must roll back the draft transition.
  const rollback = await post('/resources', fields);
  const [collision] = await pool.execute('INSERT INTO resource_reviews (version_id) VALUES (CAST(? AS UNSIGNED))',
    [rollback.version_id]);
  await decide(String(collision.insertId), 'rejected', 'Fixture collision');
  await submit(rollback, 500);
  assert.equal((await get(resourcePath(rollback))).versions[0].edit_state, 'draft');

  // Simulate a legacy resource with two drafts. The resource lock must serialize distinct Versions.
  const race = await post('/resources', fields);
  const [legacy] = await pool.execute(`INSERT INTO resource_versions
    (resource_id, version_number, title, description, author_name, category, education_level,
      resource_type, source_url, rights_basis, access_level)
    SELECT resource_id, 2, title, description, author_name, category, education_level,
      resource_type, source_url, rights_basis, access_level
    FROM resource_versions WHERE id = CAST(? AS UNSIGNED)`, [race.version_id]);
  const raced = await Promise.all([request(versionPath(race) + '/submit', 'POST'),
    request('/versions/' + legacy.insertId + '/submit', 'POST')]);
  assert.deepEqual(raced.map(response => response.status).sort(), [201, 409]);
  assert.equal((await get(resourcePath(race) + '/reviews')).length, 1);
});
