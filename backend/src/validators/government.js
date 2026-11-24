const { ApiError } = require('../utils/api-error');
const { registrationFields } = require('../services/credentials');
const { compileTeacherIdPattern } = require('./teacher-id-pattern');

function invalid(field) {
  return new ApiError(400, 'INVALID_INPUT', `Invalid ${field}`);
}

function requireFields(body, fields) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !fields.includes(key))) throw invalid('request body');
}

function text(value, max, field) {
  if (typeof value !== 'string' || !value.isWellFormed()) throw invalid(field);
  const clean = value.trim();
  if (!/[^\p{White_Space}]/u.test(clean) || [...clean].length > max || /[\u0000-\u001F\u007F]/u.test(clean)) {
    throw invalid(field);
  }
  return clean;
}

function parseStatus(status) {
  if (status !== 'active' && status !== 'suspended') throw invalid('status');
  return status;
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

function listOptions(query, schools = false) {
  const allowed = schools ? ['page', 'limit', 'status', 'search'] : ['page', 'limit'];
  if (Object.keys(query).some(key => !allowed.includes(key))) throw invalid('query parameters');
  const page = pageNumber(query.page, 1, 1000000, 'page');
  const limit = pageNumber(query.limit, 20, 100, 'limit');
  return {
    page, limit, offset: (page - 1) * limit,
    status: query.status === undefined ? undefined : parseStatus(query.status),
    search: query.search === undefined ? undefined : text(query.search, 100, 'search')
  };
}

function schoolName(body) {
  requireFields(body, ['school_name']);
  return text(body.school_name, 200, 'school_name');
}

function teacherPattern(body) {
  requireFields(body, ['teacher_id_pattern']);
  compileTeacherIdPattern(body.teacher_id_pattern);
  return body.teacher_id_pattern;
}

function statusChange(body) {
  requireFields(body, ['status']);
  return parseStatus(body.status);
}

function newSchool(body) {
  requireFields(body, ['school_code', 'school_name', 'teacher_id_pattern', 'status']);
  const code = text(body.school_code, 30, 'school_code');
  if (code !== body.school_code || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(code)) throw invalid('school_code');
  return {
    school_code: code,
    school_name: schoolName({ school_name: body.school_name }),
    teacher_id_pattern: teacherPattern({ teacher_id_pattern: body.teacher_id_pattern }),
    status: body.status === undefined ? 'active' : parseStatus(body.status)
  };
}

function newAdmin(body) {
  requireFields(body, ['full_name', 'email', 'password']);
  return registrationFields(body);
}

module.exports = { parseId, listOptions, schoolName, teacherPattern, statusChange, newSchool, newAdmin };
