function health(_req, res) {
  res.json({ status: 'ok', service: 'learning-bridge-api' });
}

function databaseHealth(checkDatabase) {
  return async (_req, res) => {
    try {
      await checkDatabase();
    } catch (cause) {
      throw Object.assign(new Error('Database unavailable', { cause }), {
        status: 503,
        code: 'DATABASE_UNAVAILABLE'
      });
    }

    res.json({ status: 'ok', database: 'connected' });
  };
}

module.exports = { health, databaseHealth };
