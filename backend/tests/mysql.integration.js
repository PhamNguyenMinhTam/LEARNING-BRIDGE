const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { createApp } = require('../src/app');
const { test } = require('node:test');
const { loadConfig } = require('../src/config/env');
const { createDatabasePool } = require('../src/config/database');
const { createDatabaseCheck } = require('../src/repositories/health.repository');

test('configured MySQL database accepts the health query', async t => {
  const pool = createDatabasePool(loadConfig().database);
  t.after(() => pool.end());

  try {
    await createDatabaseCheck(pool)();
  } catch {
    throw new Error('Live MySQL probe failed. Check the local server, schema and application account.');
  }
});


test('HTTP health survives a MySQL transport outage without leaking its details', async t => {
  const unavailable = createServer(socket => socket.destroy()).listen(0, '127.0.0.1');
  await once(unavailable, 'listening');
  t.after(() => new Promise(resolve => unavailable.close(resolve)));
  const database = loadConfig().database;
  const pool = createDatabasePool({ ...database, host: '127.0.0.1', port: unavailable.address().port });
  t.after(() => pool.end());
  const app = createApp({ nodeEnv: 'development', checkDatabase: createDatabaseCheck(pool) });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const response = await fetch(base + '/api/health/db');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' }
  });
  assert.equal((await fetch(base + '/api/health')).status, 200);
});
