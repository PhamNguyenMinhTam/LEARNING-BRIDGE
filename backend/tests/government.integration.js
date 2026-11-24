const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { MySqlSessionStore } = require('../src/repositories/session.store');
const { createUserRepository } = require('../src/repositories/user.repository');
const { createGovernmentRepository } = require('../src/repositories/government.repository');
const { createAuthService } = require('../src/services/auth.service');
const { createGovernmentService } = require('../src/services/government.service');
const { hashPassword, verifyPassword } = require('../src/services/credentials');

test('Government APIs maintain school records, scoped users and publication history on MySQL', {
  skip: process.env.RUN_MYSQL_GOVERNMENT_TEST !== '1' && 'Enable for an isolated seeded local schema'
}, async t => {
  const config = loadConfig();
  assert.equal(config.database.host, '127.0.0.1');
  assert.match(config.database.database, /^learning_bridge_(auth|government)_test(?:_[a-z0-9]+)?$/);
  const pool = createDatabasePool(config.database);
  t.after(() => pool.end());
  const users = createUserRepository(pool);
  const gov = createGovernmentRepository(pool);
  const password = 'Mật khẩu thử nghiệm 🔑';
  const email = randomUUID() + '@example.test';
  const actor = await users.create({ full_name: 'Government fixture', email, password_hash: await hashPassword(password) },
    'government');
  const origin = 'http://127.0.0.1:5500';
  const server = createApp({
    nodeEnv: 'test',
    auth: {
      ...config.session, origins: [origin], store: new MySqlSessionStore(pool), auth: createAuthService(users)
    },
    government: createGovernmentService(gov)
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;

  async function login(loginEmail) {
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password })
    });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';', 1)[0];
  }
  const cookie = await login(email);
  function request(path, method = 'GET', body) {
    return fetch(base + '/api/government' + path, {
      method, headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  async function result(response, status) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  }

  const prefix = randomUUID().slice(0, 8);
  const payload = {
    school_code: 'LB-' + prefix, school_name: 'Trường kiểm thử 100%', teacher_id_pattern: '^GV[0-9]{5}$'
  };
  const created = await result(await request('/schools', 'POST', payload), 201);
  const path = '/schools/' + created.id;
  assert.equal(created.status, 'active');
  assert.equal(typeof created.id, 'string');
  const duplicate = await result(await request('/schools', 'POST',
    { ...payload, school_code: payload.school_code.toUpperCase() }), 409);
  assert.equal(duplicate.error.code, 'SCHOOL_CODE_IN_USE');
  await result(await request('/schools', 'POST',
    { ...payload, school_code: payload.school_code + '-2', school_name: 'Trường kiểm thử khác' }), 201);
  assert.equal((await result(await request(path), 200)).teacher_id_pattern, payload.teacher_id_pattern);
  const list = await result(await request('/schools?search=' + prefix + '&status=active&limit=1&page=2'), 200);
  assert.deepEqual(list.pagination, { page: 2, limit: 1, total: 2 });
  assert.equal(list.data[0].school_code, payload.school_code + '-2');
  const literal = await result(await request('/schools?search=100%25'), 200);
  assert.ok(literal.data.some(row => row.id === created.id));
  assert.ok(literal.data.every(row => row.school_name.includes('100%')));
  const renamed = await result(await request(path, 'PATCH', { school_name: 'Trường đổi tên' }), 200);
  assert.equal(renamed.school_code, payload.school_code);
  assert.equal(renamed.school_name, 'Trường đổi tên');

  const adminEmail = randomUUID() + '@example.test';
  const adminBody = { full_name: 'School fixture', email: adminEmail.toUpperCase(), password };
  const admin = await result(await request(path + '/admins', 'POST', adminBody), 201);
  assert.equal(admin.role, 'school_admin');
  assert.equal(admin.school_id, created.id);
  assert.equal(admin.email, adminEmail);
  assert.equal('password_hash' in admin, false);
  assert.equal(await verifyPassword((await users.findByEmail(adminEmail)).password_hash, password), true);
  const admins = await result(await request(path + '/admins?limit=1'), 200);
  assert.deepEqual(admins.data, [admin]);
  assert.equal(admins.pagination.total, 1);
  const duplicateEmail = await result(await request(path + '/admins', 'POST', adminBody), 409);
  assert.equal(duplicateEmail.error.code, 'EMAIL_IN_USE');

  const adminCookie = await login(adminEmail);
  const me = () => fetch(base + '/api/auth/me', { headers: { Cookie: adminCookie } });
  await result(await request('/admins/' + actor.id + '/status', 'PATCH', { status: 'suspended' }), 404);
  assert.equal((await users.findById(actor.id)).status, 'active');

  for (let index = 0; index < 2; index++) {
    assert.equal((await result(await request(path + '/status', 'PATCH', { status: 'suspended' }), 200)).status,
      'suspended');
  }
  assert.equal((await me()).status, 200);
  const blocked = await result(await request(path + '/admins', 'POST', {
    ...adminBody, email: randomUUID() + '@example.test'
  }), 409);
  assert.equal(blocked.error.code, 'SCHOOL_SUSPENDED');
  await result(await request(path + '/status', 'PATCH', { status: 'active' }), 200);
  const adminStatus = '/admins/' + admin.id + '/status';
  assert.equal((await result(await request(adminStatus, 'PATCH', { status: 'suspended' }), 200)).status,
    'suspended');
  assert.equal((await me()).status, 401);
  assert.equal((await result(await request(adminStatus, 'PATCH', { status: 'active' }), 200)).status, 'active');
  assert.equal((await me()).status, 401);

  const [[seedSchool]] = await pool.execute("SELECT id, status, teacher_id_pattern FROM schools WHERE school_code = 'LB-MG01'");
  assert.ok(seedSchool, 'Load database/seed.sql into the isolated schema before testing');
  const seedPath = '/schools/' + seedSchool.id;
  async function history() {
    const [associations] = await pool.execute('SELECT * FROM teacher_schools WHERE school_id = ? ORDER BY id', [seedSchool.id]);
    const [resources] = await pool.execute('SELECT * FROM resources WHERE review_school_id = ? ORDER BY id', [seedSchool.id]);
    const [reviews] = await pool.execute(
      'SELECT rv.* FROM resource_reviews rv JOIN resource_versions v ON v.id = rv.version_id ' +
      'JOIN resources r ON r.id = v.resource_id WHERE r.review_school_id = ? ORDER BY rv.id', [seedSchool.id]);
    return { associations, resources, reviews };
  }
  const before = await history();
  assert.ok(before.associations.length > 0);
  assert.ok(before.reviews.length > 0);
  assert.ok(before.resources.some(resource => resource.publication_status === 'published'));
  try {
    await result(await request(seedPath + '/status', 'PATCH', { status: 'suspended' }), 200);
    await result(await request(seedPath + '/teacher-id-pattern', 'PATCH', { teacher_id_pattern: '^T[0-9]{6}$' }), 200);
    assert.deepEqual(await history(), before);
  } finally {
    await result(await request(seedPath + '/teacher-id-pattern', 'PATCH',
      { teacher_id_pattern: seedSchool.teacher_id_pattern }), 200);
    await result(await request(seedPath + '/status', 'PATCH', { status: seedSchool.status }), 200);
  }
});
