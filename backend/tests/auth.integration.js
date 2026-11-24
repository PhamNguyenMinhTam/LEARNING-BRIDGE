const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { resolve } = require('node:path');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { MySqlSessionStore } = require('../src/repositories/session.store');
const { createUserRepository } = require('../src/repositories/user.repository');
const { createAuthService } = require('../src/services/auth.service');

const enabled = process.env.RUN_MYSQL_AUTH_TEST === '1';

test('isolated MySQL persists sessions across app instances and enforces expiry and logout', {
  skip: !enabled && 'Set RUN_MYSQL_AUTH_TEST=1 for an isolated local test schema'
}, async t => {
  const config = loadConfig();
  assert.equal(config.database.host, '127.0.0.1');
  assert.match(config.database.database, /^learning_bridge_auth_test(?:_[a-z0-9]+)?$/);

  const pool = createDatabasePool(config.database);
  t.after(() => pool.end());
  const origin = 'https://learning-bridge.example.test';
  async function launch() {
    const store = new MySqlSessionStore(pool);
    const app = createApp({
      nodeEnv: 'production', trustProxy: 'loopback',
      auth: { ...config.session, origins: [origin], store, auth: createAuthService(createUserRepository(pool)) }
    });
    const server = createServer(app).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    return (path, options = {}) => fetch(base + '/api/auth/' + path, {
      ...options,
      headers: { 'X-Forwarded-Proto': 'https', Origin: origin, ...options.headers }
    });
  }

  const a = await launch();
  const b = await launch();
  const email = randomUUID() + '@example.test';
  const input = { full_name: 'Giáo viên thử nghiệm', email, password: 'Mật khẩu thử nghiệm 🔑' };
  const json = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) };
  assert.equal((await a('login', { ...json, headers: { ...json.headers, 'X-Forwarded-Proto': 'http' } })).status, 403);
  const registrations = await Promise.all([a('register', json), b('register', json)]);
  assert.deepEqual(registrations.map(response => response.status).sort(), [201, 409]);
  const created = await registrations.find(response => response.status === 201).json();
  assert.equal(created.role, 'teacher');
  assert.equal(typeof created.id, 'string');
  assert.equal('password_hash' in created, false);

  async function login() {
    const response = await a('login', json);
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /; Secure/i);
    return { headers: { Cookie: cookie.split(';', 1)[0] } };
  }
  const session = await login();
  const current = await b('me', session);
  assert.equal(current.status, 200);
  assert.deepEqual(await current.json(), created);
  const logout = await b('logout', { ...session, method: 'POST' });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /; Secure/i);
  assert.equal((await a('me', session)).status, 401);

  const expired = await login();
  await pool.execute(
    'UPDATE auth_sessions SET expires_at = 0 WHERE JSON_UNQUOTE(JSON_EXTRACT(data, "$.userId")) = ?',
    [created.id]
  );
  assert.equal((await b('me', expired)).status, 401);
  await new MySqlSessionStore(pool).pruneExpired();

  const suspended = await login();
  await pool.execute("UPDATE users SET status = 'suspended' WHERE id = CAST(? AS UNSIGNED)", [created.id]);
  assert.equal((await b('me', suspended)).status, 401);

  const governmentEmail = randomUUID() + '@example.test';
  const cli = resolve(__dirname, '../scripts/bootstrap-government.js');
  function bootstrap() {
    return new Promise(resolve => {
      const child = execFile(process.execPath, [cli, governmentEmail, 'Government test'],
        (error, stdout, stderr) => resolve({ error, stdout, stderr }));
      child.stdin.end(input.password + '\n', 'utf8');
    });
  }
  assert.equal((await bootstrap()).error, null);
  assert.match((await bootstrap()).stderr, /already exists/i);
  const government = await a('login', { ...json, body: JSON.stringify({ ...input, email: governmentEmail }) });
  assert.equal(government.status, 200);
  assert.equal((await government.json()).role, 'government');
});
