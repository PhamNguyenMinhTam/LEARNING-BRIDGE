const { invalid, requireFields, text, parseId, pageNumber } = require('./input');
const { registrationFields } = require('../services/credentials');
const { compileTeacherIdPattern } = require('./teacher-id-pattern');

function parseStatus(status) {
  if (status !== 'active' && status !== 'suspended') throw invalid('status');
  return status;
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
