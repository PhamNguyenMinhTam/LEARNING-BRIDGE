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
