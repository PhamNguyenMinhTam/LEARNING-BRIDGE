const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { MemoryStore } = require('express-session');
const { createApp } = require('../src/app');
const { createGovernmentService } = require('../src/services/government.service');
const { verifyPassword } = require('../src/services/credentials');

const origin = 'http://127.0.0.1:5500';
const school = { school_code: 'GV-01', school_name: 'Trường Một', teacher_id_pattern: '^GV[0-9]{5}$' };
const admin = { full_name: 'Quản trị Một', email: ' Admin@Example.test ', password: 'Mật khẩu thử nghiệm 🔑' };

async function fixture(t, repository = {}) {
  const rows = ['government', 'teacher', 'school_admin'].map((role, index) => ({
    id: String(index + 1), role, status: 'active'
  }));
  const auth = {
    authenticate: async ({ email }) => rows.find(row => row.role === email),
    activeProfile: async id => {
      const row = rows.find(item => item.id === id);
      return row?.status === 'active' ? row : null;
    }
  };
  const server = createApp({
    nodeEnv: 'test',
    auth: {
      auth, origins: [origin], store: new MemoryStore(), name: 'government.test',
      secret: randomBytes(32).toString('base64url'), maxAge: 60000
    },
    government: createGovernmentService(repository)
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function cookie(role) {
    const login = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: role })
    });
    assert.equal(login.status, 200);
    return login.headers.get('set-cookie').split(';', 1)[0];
  }
  async function request(path, { method = 'GET', token, body, requestOrigin = origin } = {}) {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (token) headers.set('Cookie', token);
    if (requestOrigin) headers.set('Origin', requestOrigin);
    return fetch(base + '/api/government' + path, { method, headers, body: JSON.stringify(body) });
  }
  return { request, cookie, rows, base };
}

test('Government routes reject absent sessions and other roles before dispatch; suspended actors lose access', async t => {
  const { request, cookie, rows } = await fixture(t, {
    listSchools: async () => ({ data: [], total: 0 })
  });
  assert.equal((await request('/schools')).status, 401);
  assert.equal((await request('/schools', { method: 'POST', requestOrigin: null, body: school })).status, 401);
  const teacher = await cookie('teacher');
  const schoolAdmin = await cookie('school_admin');
  const government = await cookie('government');
  for (const token of [teacher, schoolAdmin]) {
    assert.equal((await request('/schools', { token })).status, 403);
    assert.equal((await request('/schools/1/status', { method: 'PATCH', token,
      body: { status: 'suspended' } })).status, 403);
    assert.equal((await request('/schools/1/admins', { method: 'POST', token,
      body: { ...admin, role: 'government' } })).status, 403);
    assert.equal((await request('/admins/3/status', { method: 'PATCH', token,
      body: { status: 'suspended' } })).status, 403);
  }
  assert.equal((await request('/schools', { token: government })).status, 200);
  rows[0].status = 'suspended';
  assert.equal((await request('/schools', { token: government })).status, 401);
});

test('School operations validate explicit fields, bounded ids, statuses and pagination', async t => {
  const created = { ...school, id: '1', status: 'active' };
  const findSchool = t.mock.fn(async id => id === '1' ? created : undefined);
  const createSchool = t.mock.fn(async () => created);
  const updateSchool = t.mock.fn(async (id, key, value) => id === '1' ? { ...created, [key]: value } : undefined);
  const listSchools = t.mock.fn(async () => ({ data: [created], total: 9 }));
  const { request, cookie } = await fixture(t, { findSchool, createSchool, updateSchool, listSchools });
  const token = await cookie('government');
  const post = body => request('/schools', { method: 'POST', token, body });
  const patch = (path, body) => request('/schools/1' + path, { method: 'PATCH', token, body });

  assert.equal((await post({ ...school, school_name: undefined })).status, 400);
  assert.equal((await post({ ...school, school_code: 'GV 01' })).status, 400);
  assert.equal((await post(school)).status, 201);
  assert.deepEqual(createSchool.mock.calls[0].arguments[0], { ...school, status: 'active' });
  for (const id of ['0', '-1', '1.5', '18446744073709551616']) {
    assert.equal((await request('/schools/' + id, { token })).status, 400);
  }
  assert.equal((await request('/schools/999', { token })).status, 404);
  assert.equal((await request('/schools/1', { token })).status, 200);
  assert.equal(findSchool.mock.callCount(), 2);
  assert.equal((await patch('', { school_code: 'NEW', school_name: 'Updated' })).status, 400);
  assert.equal((await patch('/status', { status: 'deleted' })).status, 400);
  assert.equal((await patch('/teacher-id-pattern', { teacher_id_pattern: '^(a+)+$' })).status, 400);
  assert.equal(updateSchool.mock.callCount(), 0);
  assert.equal((await (await patch('', { school_name: ' Updated ' })).json()).school_name, 'Updated');
  assert.equal((await (await patch('/status', { status: 'suspended' })).json()).status, 'suspended');
  assert.equal((await (await patch('/teacher-id-pattern', { teacher_id_pattern: '^T[0-9]{6}$' })).json()).teacher_id_pattern,
    '^T[0-9]{6}$');
  for (const query of ['limit=101', 'page=2&page=3', 'page=0', 'status=deleted', 'search=']) {
    assert.equal((await request('/schools?' + query, { token })).status, 400);
  }
  const result = await request('/schools?page=2&limit=3&search=GV&status=active', { token });
  assert.deepEqual((await result.json()).pagination, { page: 2, limit: 3, total: 9 });
  assert.deepEqual(listSchools.mock.calls[0].arguments[0], {
    page: 2, limit: 3, offset: 3, search: 'GV', status: 'active'
  });
});

test('provisions only with validated URL and credentials, blocks CSRF and limits repeated provisioning', async t => {
  const provisionAdmin = t.mock.fn(async (schoolId, fields) => ({
    id: '5', school_id: schoolId, role: 'school_admin', email: fields.email
  }));
  const { request, cookie, base } = await fixture(t, { provisionAdmin });
  const token = await cookie('government');
  const path = '/schools/18446744073709551615/admins';
  const post = (body, requestOrigin) => request(path, { method: 'POST', token, body, requestOrigin });
  assert.equal((await post(admin, null)).status, 403);
  assert.equal((await post(admin, 'https://untrusted.example')).status, 403);
  assert.equal((await request('/schools/1/status', { method: 'PATCH', token, requestOrigin: null,
    body: { status: 'suspended' } })).status, 403);
  const preflight = await fetch(base + '/api/government/schools/1/status', {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PATCH' }
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /PATCH/);
  assert.equal((await post({ ...admin, role: 'government', school_id: '3' })).status, 400);
  assert.equal(provisionAdmin.mock.callCount(), 0);
  const response = await post(admin);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    id: '5', school_id: '18446744073709551615', role: 'school_admin', email: 'admin@example.test'
  });
  const [id, fields] = provisionAdmin.mock.calls[0].arguments;
  assert.equal(id, '18446744073709551615');
  assert.equal('password' in fields, false);
  assert.equal(await verifyPassword(fields.password_hash, admin.password), true);
  for (let index = 0; index < 8; index++) assert.equal((await post({})).status, 400);
  assert.equal((await post(admin)).status, 429);
});
