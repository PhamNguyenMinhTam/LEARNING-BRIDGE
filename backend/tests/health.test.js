const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../src/app');

async function serve(t, config) {
  const server = createServer(createApp(config));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('constructs an Express app without opening a server or checking MySQL', t => {
  const checkDatabase = t.mock.fn();
  const listen = t.mock.method(require('node:net').Server.prototype, 'listen',
    () => assert.fail('Application initialization opened a server'));
  assert.equal(typeof createApp({ nodeEnv: 'development', checkDatabase }), 'function');
  assert.equal(listen.mock.callCount(), 0);
  assert.equal(checkDatabase.mock.callCount(), 0);
});

test('liveness returns the service name independently of MySQL', async t => {
  const checkDatabase = t.mock.fn(() => assert.fail('Liveness touched MySQL'));
  const base = await serve(t, { nodeEnv: 'development', checkDatabase });
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'learning-bridge-api' });
  assert.equal(checkDatabase.mock.callCount(), 0);
});

test('unknown routes return JSON 404', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NOT_FOUND', message: 'Route not found' }
  });
});

test('malformed JSON returns a sanitized 400 in production', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"private-marker":'
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: { code: 'INVALID_JSON', message: 'Malformed JSON body' }
  });
});

test('JSON larger than 32 KB returns 413', async t => {
  const base = await serve(t);
  const response = await fetch(`${base}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'a'.repeat(33 * 1024) })
  });
  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
});

test('database health returns 200 with a successful mock', async t => {
  const checkDatabase = t.mock.fn(async () => {});
  const base = await serve(t, { nodeEnv: 'development', checkDatabase });
  const response = await fetch(`${base}/api/health/db`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
  assert.equal(checkDatabase.mock.callCount(), 1);
});

test('database health returns sanitized 503 with a failed mock', async t => {
  const checkDatabase = async () => {
    throw Object.assign(new Error('Internal connection details'), { code: 'ECONNREFUSED' });
  };
  const base = await serve(t, { nodeEnv: 'development', checkDatabase });
  const response = await fetch(`${base}/api/health/db`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' }
  });
});

test('production hides database health and ignores forwarded loopback addresses', async t => {
  const checkDatabase = t.mock.fn();
  const base = await serve(t, { nodeEnv: 'production', checkDatabase });
  const response = await fetch(`${base}/api/health/db`, {
    headers: { 'X-Forwarded-For': '127.0.0.1' }
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
  assert.equal(checkDatabase.mock.callCount(), 0);
});

test('CORS allows only configured origins without credentials', async t => {
  const origin = 'http://127.0.0.1:5500';
  const base = await serve(t, { corsOrigins: [origin] });
  const allowed = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
  assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'), null);
  const denied = await fetch(`${base}/api/health`, {
    headers: { Origin: 'http://localhost:5500' }
  });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});
