function createDatabaseCheck(pool) {
  return async function checkDatabase() {
    await pool.query({ sql: 'SELECT 1 AS ready', timeout: 3000 });
  };
}

module.exports = { createDatabaseCheck };
