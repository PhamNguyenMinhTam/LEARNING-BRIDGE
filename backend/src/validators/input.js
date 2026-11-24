const { ApiError } = require('../utils/api-error');

function invalid(field) {
  return new ApiError(400, 'INVALID_INPUT', `Invalid ${field}`);
}

function requireFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !fields.includes(key))) throw invalid('request body');
}

function text(value, max, field, multiline = false) {
  if (typeof value !== 'string' || !value.isWellFormed()) throw invalid(field);
  const clean = value.trim();
  if (!/[^\p{White_Space}]/u.test(clean) || [...clean].length > max || (multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u : /[\u0000-\u001F\u007F]/u).test(clean)) {
    throw invalid(field);
  }
  return clean;
}

function parseId(id) {
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,19}$/.test(id) ||
      BigInt(id) > 18446744073709551615n) throw invalid('id');
  return id;
}

function pageNumber(value, fallback, maximum, field) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || Number(value) > maximum) {
    throw invalid(field);
  }
  return Number(value);
}

module.exports = { invalid, requireFields, text, parseId, pageNumber };
