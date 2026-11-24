const path = require('node:path');
const { tmpdir } = require('node:os');
const dotenv = require('dotenv');

function port(value, name) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`Invalid ${name}`);
  }
  return Number(value);
}

function parseOrigin(value, name, requireHttps = false) {
  const url = URL.parse(value);
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.origin !== value ||
      (requireHttps && url.protocol !== 'https:')) {
    throw new Error(`Invalid ${name} entry`);
  }
  return url.origin;
}

function parseOrigins(value, name, requireHttps = false) {
  return value.split(',').map(origin => origin.trim()).filter(Boolean)
    .map(origin => parseOrigin(origin, name, requireHttps));
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

  const httpPort = port(env.PORT ?? '3000', 'PORT');
  const production = nodeEnv === 'production';
  const secret = env.SESSION_SECRET;
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new Error('SESSION_SECRET must be 32 random bytes encoded as base64url');
  }
  const name = env.SESSION_COOKIE_NAME ?? 'learning_bridge.sid';
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(name)) throw new Error('Invalid SESSION_COOKIE_NAME');
  const maxAge = Number(env.SESSION_MAX_AGE_MS ?? '1800000');
  if (!Number.isSafeInteger(maxAge) || maxAge < 60000 || maxAge > 28800000) {
    throw new Error('SESSION_MAX_AGE_MS must be between 60000 and 28800000');
  }
  const proxy = env.TRUST_PROXY ?? 'off';
  if (!['off', 'loopback'].includes(proxy)) throw new Error('Invalid TRUST_PROXY');

  const defaultOrigin = `http://127.0.0.1${httpPort === 80 ? '' : ':' + httpPort}`;
  const origins = parseOrigins(env.AUTH_ORIGINS ?? (production ? '' : defaultOrigin),
    'AUTH_ORIGINS', production);
  if (origins.length === 0) throw new Error('Set AUTH_ORIGINS to the trusted application origins');

  const maxSize = Number(env.TEACHER_PDF_MAX_BYTES ?? 10485760);
  if (!Number.isSafeInteger(maxSize) || maxSize < 1 || maxSize > 26214400) {
    throw new Error('Invalid TEACHER_PDF_MAX_BYTES');
  }
  let uploadDirectory = path.resolve(__dirname, '../../private-uploads');
  if (nodeEnv === 'test' && env.E2E_UPLOAD_DIRECTORY) {
    const candidate = path.resolve(env.E2E_UPLOAD_DIRECTORY);
    const relative = path.relative(tmpdir(), candidate);
    if (!/^lb-e2e-uploads-[a-z0-9-]+$/i.test(relative)) throw new Error('Invalid E2E_UPLOAD_DIRECTORY');
    uploadDirectory = candidate;
  }
  return {
    nodeEnv,
    upload: { directory: uploadDirectory, maxSize },
    host,
    port: httpPort,
    trustProxy: proxy === 'loopback' ? 'loopback' : false,
    corsOrigins: parseOrigins(env.CORS_ORIGINS ?? '', 'CORS_ORIGINS'),
    session: { secret, name, maxAge, secure: production, origins },
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
