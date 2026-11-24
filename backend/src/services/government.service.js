const validation = require('../validators/government');
const { hashPassword } = require('./credentials');
const { ApiError } = require('../utils/api-error');

function found(value, label) {
  if (!value) throw new ApiError(404, 'NOT_FOUND', `${label} not found`);
  return value;
}

function paginated({ data, total }, { page, limit }) {
  return { data, pagination: { page, limit, total } };
}

function createGovernmentService(repository) {
  return {
    async listSchools(query) {
      const options = validation.listOptions(query, true);
      return paginated(await repository.listSchools(options), options);
    },
    async getSchool(id) {
      return found(await repository.findSchool(validation.parseId(id)), 'School');
    },
    createSchool(body) {
      return repository.createSchool(validation.newSchool(body));
    },
    async updateSchoolName(id, body) {
      return found(await repository.updateSchool(validation.parseId(id), 'school_name',
        validation.schoolName(body)), 'School');
    },
    async updateSchoolStatus(id, body) {
      return found(await repository.updateSchool(validation.parseId(id), 'status',
        validation.statusChange(body)), 'School');
    },
    async updateTeacherPattern(id, body) {
      return found(await repository.updateSchool(validation.parseId(id), 'teacher_id_pattern',
        validation.teacherPattern(body)), 'School');
    },
    async listAdmins(id, query) {
      const options = validation.listOptions(query);
      const result = await repository.listAdmins(validation.parseId(id), options);
      return paginated(found(result, 'School'), options);
    },
    async createAdmin(id, body) {
      const schoolId = validation.parseId(id);
      const { full_name, email, password } = validation.newAdmin(body);
      const password_hash = await hashPassword(password);
      return found(await repository.provisionAdmin(schoolId, { full_name, email, password_hash }), 'School');
    },
    async updateAdminStatus(id, body) {
      return found(await repository.updateAdminStatus(validation.parseId(id),
        validation.statusChange(body)), 'School Administrator');
    }
  };
}

module.exports = { createGovernmentService };
