const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { createServer } = require('node:http');
const express = require('express');
const { MemoryStore } = require('express-session');
const { createApp } = require('../src/app');
const { createAuthService } = require('../src/services/auth.service');
const { hashPassword, verifyPassword } = require('../src/services/credentials');
const { requireAuth, requireRole, requireSchoolScope } = require('../src/middlewares/authorization');
const { createSessionMiddleware } = require('../src/config/session');
const { errorHandler } = require('../src/middlewares/error.middleware');
const { ApiError } = require('../src/utils/api-error');

const origin = 'http://localhost:5500';
const password = 'Bảo mật 🔑 thật dài';
const credentials = { full_name: ' Nguyễn Văn A ', email: ' Teacher@Example.com ', password };

async function serve(t, app) {
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

async function fixtures(t, mount) {
  const records = new Map();
  const schools = new Map([['1', { id: '1', status: 'active' }], ['2', { id: '2', status: 'active' }]]);
  const users = {
    async create(fields, role) {
      if (records.has(fields.email)) throw new ApiError(409, 'EMAIL_IN_USE', 'Email already registered');
      const row = { ...fields, id: String(records.size + 1), role, status: 'active', school_id: null };
      records.set(fields.email, row);
      return row;
    },
    findByEmail: async email => records.get(email),
    findById: async id => [...records.values()].find(row => row.id === id),
    findSchoolById: async id => schools.get(id)
  };
  const auth = createAuthService(users);
  const store = new MemoryStore();
  const options = { store, secret: randomBytes(32).toString('base64url'), name: 'test.sid', maxAge: 60000 };
  const app = express();
  if (mount) mount(app, auth, createSessionMiddleware(options), users);
  app.use(createApp({ nodeEnv: 'test', auth: { auth, origins: [origin], ...options } }));
  const base = await serve(t, app);
  const post = (path, data, headers = {}) => fetch(base + '/api/auth/' + path, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  });
  const me = cookie => fetch(base + '/api/auth/me', { headers: cookie ? { Cookie: cookie } : {} });
  return { base, post, me, records, users, schools, store };
}

function sessionCookie(response) {
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('register creates a Teacher and hashes Unicode; injected permissions are ignored', async t => {
  const { post, records } = await fixtures(t);
  const response = await post('register', { ...credentials, role: 'government', school_id: '1' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('set-cookie'), null);
  const result = await response.json();
  assert.deepEqual(result, {
    id: '1', full_name: 'Nguyễn Văn A', email: 'teacher@example.com', role: 'teacher',
    status: 'active', school_id: null
  });
  const stored = records.get(result.email);
  assert.match(stored.password_hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(stored.password_hash, password), true);
  assert.equal('password' in stored, false);
  assert.equal((await post('register', { ...credentials, email: 'TEACHER@example.com' })).status, 409);
});

test('rejects invalid registration fields with sanitized JSON', async t => {
  const { post, records } = await fixtures(t);
  for (const fields of [
    { ...credentials, email: 'a..b@example.com' }, { ...credentials, password: undefined },
    { ...credentials, password: '🔑'.repeat(257) }, null, []
  ]) {
    const response = await post('register', fields);
    assert.equal(response.status, 400);
    const { error } = await response.json();
    assert.ok(['INVALID_INPUT', 'INVALID_JSON'].includes(error.code));
    assert.deepEqual(Object.keys(error).sort(), ['code', 'message']);
  }
  assert.equal(records.size, 0);
});

test('login sets a safe cookie and rotates an existing session; logout invalidates it', async t => {
  const { post, me, store } = await fixtures(t);
  await post('register', credentials);
  assert.equal((await me()).status, 401);
  const first = await post('login', credentials);
  assert.equal(first.status, 200);
  const cookieHeader = first.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i);
  assert.match(cookieHeader, /SameSite=Lax/i);
  assert.match(cookieHeader, /Path=\/api/);
  assert.doesNotMatch(cookieHeader, /; Secure/i);
  const cookie = sessionCookie(first);
  const firstProfile = await first.json();
  assert.equal('password_hash' in firstProfile, false);

  const rows = await new Promise((resolve, reject) => store.all((error, result) => error ? reject(error) : resolve(result)));
  assert.deepEqual(Object.keys(Object.values(rows)[0]).sort(), ['cookie', 'userId']);
  const second = await post('login', credentials, { Cookie: cookie });
  assert.equal(second.status, 200);
  const rotated = sessionCookie(second);
  assert.notEqual(rotated, cookie);
  assert.equal((await me(cookie)).status, 401);
  const profile = await me(rotated);
  assert.equal(profile.status, 200);
  assert.deepEqual(await profile.json(), firstProfile);

  const logout = await post('logout', undefined, { Cookie: rotated });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Path=\/api/);
  assert.equal((await me(rotated)).status, 401);
  assert.equal((await post('logout', undefined, { Cookie: rotated })).status, 204);
});

test('wrong password, unknown email and suspended account get the same 401', async t => {
  const { post, records } = await fixtures(t);
  await post('register', credentials);
  const responses = [
    await post('login', { ...credentials, password: 'wrong password' }),
    await post('login', { ...credentials, email: 'unknown@example.com' })
  ];
  records.get('teacher@example.com').status = 'suspended';
  responses.push(await post('login', credentials));
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
    });
  }
});

test('suspension revokes a previous session', async t => {
  const { post, me, records } = await fixtures(t);
  await post('register', credentials);
  const cookie = sessionCookie(await post('login', credentials));
  records.get('teacher@example.com').status = 'suspended';
  assert.equal((await me(cookie)).status, 401);
  records.get('teacher@example.com').status = 'active';
  assert.equal((await me(cookie)).status, 401);
});

test('blocks cross-site or missing Origin and supports trusted credentialed preflight', async t => {
  const { base, post, me } = await fixtures(t);
  await post('register', credentials);
  const cookie = sessionCookie(await post('login', credentials));
  for (const path of ['register', 'login', 'logout']) {
    const denied = await post(path, credentials, { Origin: 'https://untrusted.example', Cookie: cookie });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal((await denied.json()).error.code, 'ORIGIN_DENIED');
  }
  assert.equal((await fetch(base + '/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status, 403);
  assert.equal((await me(cookie)).status, 200);
  const preflight = await fetch(base + '/api/auth/login', {
    method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type'
    }
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
});

test('enforces role and active school scope derived from a server-loaded target', async t => {
  const { base, post, users, schools } = await fixtures(t, (app, auth, session, repository) => {
    const authenticated = [session.load, requireAuth(auth, session.clear)];
    const ok = (_req, res) => res.sendStatus(204);
    app.get('/api/test/government', ...authenticated, requireRole('government'), ok);
    app.get('/api/test/school/:resource', ...authenticated, requireRole('school_admin'),
      requireSchoolScope({
        getTargetSchoolId: req => ({ own: '1', other: '2' })[req.params.resource],
        findSchoolById: repository.findSchoolById
      }), ok);
    app.use(errorHandler('test'));
  });
  const hash = await hashPassword(password);
  for (const role of ['teacher', 'school_admin', 'government']) {
    await users.create({ email: role + '@example.com', full_name: role, password_hash: hash }, role);
  }
  (await users.findByEmail('school_admin@example.com')).school_id = '1';
  async function as(role) {
    const cookie = sessionCookie(await post('login', { email: role + '@example.com', password }));
    return path => fetch(base + '/api/test/' + path, { headers: { Cookie: cookie } });
  }
  const teacher = await as('teacher');
  assert.equal((await teacher('school/own')).status, 403);
  assert.equal((await teacher('government')).status, 403);
  const school = await as('school_admin');
  assert.equal((await school('government')).status, 403);
  assert.equal((await school('school/own')).status, 204);
  assert.equal((await school('school/other?school_id=1')).status, 403);
  schools.get('1').status = 'suspended';
  assert.equal((await school('school/own')).status, 403);
  const government = await as('government');
  assert.equal((await government('school/own')).status, 403);
  assert.equal((await government('government')).status, 204);
});

test('limits login and registration independently', async t => {
  const { post } = await fixtures(t);
  for (const [path, count, status] of [['login', 10, 401], ['register', 5, 400]]) {
    for (let i = 0; i < count; i++) assert.equal((await post(path, {})).status, status);
    const blocked = await post(path, {});
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers.get('retry-after'));
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  }
});

test('refuses production MemoryStore and sanitizes session dependency failures', async t => {
  const options = { store: new MemoryStore(), secret: randomBytes(32).toString('base64url'), name: 'test.sid', maxAge: 60000 };
  assert.throws(() => createSessionMiddleware({ ...options, secure: true }), /persistent session store/);

  const { post, me, store } = await fixtures(t);
  await post('register', credentials);
  const sessionFailure = new Error('sensitive internal MySQL details');
  t.mock.method(store, 'set', (_id, _session, callback) => callback(sessionFailure));
  const failedLogin = await post('login', credentials);
  assert.equal(failedLogin.status, 503);
  assert.equal(failedLogin.headers.get('set-cookie'), null);
  assert.deepEqual(await failedLogin.json(), {
    error: { code: 'SESSION_UNAVAILABLE', message: 'Session storage unavailable' }
  });
  t.mock.restoreAll();
  const cookie = sessionCookie(await post('login', credentials));
  t.mock.method(store, 'get', (_id, callback) => callback(sessionFailure));
  const failedProfile = await me(cookie);
  assert.equal(failedProfile.status, 503);
  assert.equal((await failedProfile.json()).error.code, 'SESSION_UNAVAILABLE');
});
