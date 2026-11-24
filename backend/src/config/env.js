const path = require('node:path');
const dotenv = require('dotenv');

function port(value, name) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`Invalid ${name}`);
  }
  return Number(value);
}

function parseOrigin(value) {
  const url = URL.parse(value);
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== value) {
    throw new Error('Invalid CORS_ORIGINS entry');
  }
  return url.origin;
}

function loadConfig() {
  const result = dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
  if (result.error && result.error.code !== 'ENOENT') {
    throw new Error('Unable to read backend/.env');
  }

  const env = process.env;
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('Invalid NODE_ENV');
  }

  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  const user = env.DB_USER.trim();
  if (user.toLowerCase() === 'root') throw new Error('DB_USER must be a limited application account');
  if (env.DB_PASSWORD === 'replace_with_local_password') throw new Error('Set DB_PASSWORD');

  const host = env.HOST?.trim() ?? '127.0.0.1';
  if (!host) throw new Error('Invalid HOST');

  return {
    nodeEnv,
    host,
    port: port(env.PORT ?? '3000', 'PORT'),
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map(value => value.trim())
      .filter(Boolean).map(parseOrigin),
    database: {
      host: env.DB_HOST.trim(),
      port: port(env.DB_PORT ?? '3306', 'DB_PORT'),
      user,
      password: env.DB_PASSWORD,
      database: env.DB_NAME.trim()
    }
  };
}

module.exports = { loadConfig };
