const { withTransaction } = require('../repositories/mysql');
const { parseId } = require('../validators/input');
const { associationInput, associationStatus } = require('../validators/teacher');
const { compileTeacherIdPattern } = require('../validators/teacher-id-pattern');
const { ApiError } = require('../utils/api-error');

function missing(label) {
  return new ApiError(404, 'NOT_FOUND', label + ' not found');
}

function conflict(code, message) {
  return new ApiError(409, code, message);
}

function checkPattern(school, code, status) {
  let matches;
  try {
    matches = compileTeacherIdPattern(school.teacher_id_pattern);
  } catch {
    throw conflict('SCHOOL_PATTERN_UNAVAILABLE', 'School Teacher ID pattern is unsupported');
  }
  if (!matches(code)) throw new ApiError(status, 'TEACHER_CODE_MISMATCH', 'Teacher code does not match the current format');
}

function createTeacherSchoolService(pool, associations, resources) {
  async function activeTeacher(db, teacherId) {
    if (!await resources.activeTeacher(db, teacherId)) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication required');
  }

  async function activeSchool(db, schoolId) {
    const school = await associations.schoolForUpdate(db, schoolId);
    if (!school) throw missing('School');
    if (school.status !== 'active') throw conflict('SCHOOL_SUSPENDED', 'School is suspended');
    return school;
  }

  return {
    available: associations.available,
    list: associations.list,
    async eligible(db, teacherId, schoolId) {
      const school = await activeSchool(db, schoolId);
      await activeTeacher(db, teacherId);
      const association = await associations.pairForUpdate(db, teacherId, schoolId);
      if (association?.status !== 'active') throw conflict('ASSOCIATION_REQUIRED', 'An active School association is required');
      checkPattern(school, association.teacher_code, 409);
      return association;
    },
    activeTeacher,
    declare(teacherId, body) {
      const { schoolId, code } = associationInput(body);
      return withTransaction(pool, async db => {
        const school = await activeSchool(db, schoolId);
        await activeTeacher(db, teacherId);
        const row = await associations.pairForUpdate(db, teacherId, schoolId);
        if (row?.status === 'active') throw conflict('ASSOCIATION_EXISTS', 'School association already active');
        checkPattern(school, code, 400);
        const id = row?.id ?? await associations.insert(db, teacherId, schoolId, code);
        if (row) await associations.activate(db, id, code);
        return { created: !row, association: await associations.association(db, teacherId, id) };
      });
    },
    changeStatus(teacherId, id, body) {
      parseId(id);
      const status = associationStatus(body);
      return withTransaction(pool, async db => {
        const current = await associations.association(db, teacherId, id);
        if (!current) throw missing('School association');
        const school = status === 'active' ? await activeSchool(db, current.school_id)
          : await associations.schoolForUpdate(db, current.school_id);
        await activeTeacher(db, teacherId);
        const row = await associations.pairForUpdate(db, teacherId, current.school_id);
        if (!row || row.id !== id) throw missing('School association');
        if (status === 'active') {
          checkPattern(school, row.teacher_code, 409);
          await associations.activate(db, id, row.teacher_code);
        } else {
          await associations.inactivate(db, id);
        }
        return { ...await associations.association(db, teacherId, id), school_status: school.status };
      });
    }
  };
}

module.exports = { createTeacherSchoolService };
