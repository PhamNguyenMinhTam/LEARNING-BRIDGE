const argon2 = require('argon2');
const { ApiError } = require('../utils/api-error');

const hashingOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
// A hash of random material used to perform comparable work for unknown accounts.
const dummyHash = '$argon2id$v=19$m=19456,t=2,p=1$J6ujDIqmtTDXJQ3u9fB99g$kACCoBIBDPyiRFjLva3uIBPFUrERS38PHTH+Amu+SnE';

function invalidInput() {
  return new ApiError(400, 'INVALID_INPUT', 'Invalid authentication input');
}

function invalidCredentials() {
  return new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  const [local, domain, extra] = email.split('@');
  const atom = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+$/;
  const domainLabel = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  if (extra !== undefined || !domain || email.length > 255 || local.length > 64 ||
      !local.split('.').every(part => atom.test(part)) ||
      !domain.includes('.') || !domain.split('.').every(part => domainLabel.test(part))) {
    return null;
  }
  return email.toLowerCase();
}

function validPassword(password) {
  return typeof password === 'string' && password.length > 0 && password.isWellFormed() &&
    Buffer.byteLength(password, 'utf8') <= 1024;
}

function registrationFields({ full_name, email, password } = {}) {
  const name = typeof full_name === 'string' ? full_name.trim() : '';
  const normalized = normalizeEmail(email);
  if (!normalized || !/[^\p{White_Space}]/u.test(name) || !name.isWellFormed() || [...name].length > 150 ||
      !validPassword(password) || [...password].length < 12) {
    throw invalidInput();
  }
  return { full_name: name, email: normalized, password };
}

function hashPassword(password) {
  return argon2.hash(password, hashingOptions);
}

async function verifyPassword(hash, password) {
  // Database fixtures contain placeholders. Treat those as non-authenticating accounts.
  const usable = typeof hash === 'string' && hash.startsWith('$argon2id$');
  const matched = await argon2.verify(usable ? hash : dummyHash, password);
  return usable && matched;
}

module.exports = {
  hashPassword, verifyPassword, normalizeEmail, validPassword, registrationFields,
  invalidInput, invalidCredentials
};
