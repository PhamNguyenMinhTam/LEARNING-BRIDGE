const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const { createDatabasePool } = require('./config/database');
const { createDatabaseCheck } = require('./repositories/health.repository');
const { createUserRepository } = require('./repositories/user.repository');
const { createAuthService } = require('./services/auth.service');
const { MySqlSessionStore } = require('./repositories/session.store');

function start() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const pool = createDatabasePool(config.database);
  const store = new MySqlSessionStore(pool);
  const app = createApp({
    ...config,
    checkDatabase: createDatabaseCheck(pool),
    auth: { ...config.session, store, auth: createAuthService(createUserRepository(pool)) }
  });
  const cleanup = setInterval(() => {
    store.pruneExpired().catch(() => console.error('Could not prune expired sessions'));
  }, 15 * 60 * 1000);
  cleanup.unref();
  const server = app.listen(config.port, config.host);
  let shuttingDown = false;

  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(cleanup);
    const deadline = setTimeout(() => {
      console.error('Shutdown timed out');
      process.exit(1);
    }, 10000);
    deadline.unref();

    try {
      if (server.listening) {
        await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
        });
      }
    } catch {
      console.error('Could not close the HTTP server');
      process.exitCode = 1;
    } finally {
      try {
        await pool.end();
      } catch {
        console.error('Could not close the MySQL pool');
        process.exitCode = 1;
      } finally {
        clearTimeout(deadline);
      }
    }
  }

  server.once('listening', () => console.log('Learning Bridge HTTP server is listening'));
  server.on('error', error => {
    const code = ['EACCES', 'EADDRINUSE', 'EADDRNOTAVAIL', 'ENOTFOUND'].includes(error.code)
      ? error.code : 'SERVER_ERROR';
    console.error('HTTP server failed', code);
    process.exitCode = 1;
    void shutdown();
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  try {
    start();
  } catch {
    console.error('Could not start the API');
    process.exitCode = 1;
  }
}
