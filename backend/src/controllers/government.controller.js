function createGovernmentController(service) {
  return {
    async listSchools(req, res) {
      res.json(await service.listSchools(req.query));
    },
    async getSchool(req, res) {
      res.json(await service.getSchool(req.params.id));
    },
    async createSchool(req, res) {
      res.status(201).json(await service.createSchool(req.body));
    },
    async updateSchoolName(req, res) {
      res.json(await service.updateSchoolName(req.params.id, req.body));
    },
    async updateSchoolStatus(req, res) {
      res.json(await service.updateSchoolStatus(req.params.id, req.body));
    },
    async updateTeacherPattern(req, res) {
      res.json(await service.updateTeacherPattern(req.params.id, req.body));
    },
    async listAdmins(req, res) {
      res.json(await service.listAdmins(req.params.id, req.query));
    },
    async createAdmin(req, res) {
      res.status(201).json(await service.createAdmin(req.params.id, req.body));
    },
    async updateAdminStatus(req, res) {
      res.json(await service.updateAdminStatus(req.params.id, req.body));
    }
  };
}

module.exports = { createGovernmentController };
