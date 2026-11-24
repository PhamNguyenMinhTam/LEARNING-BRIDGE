function createTeacherController(schools, resources) {
  return {
    profile(req, res) {
      const { id, full_name, email, role, status, created_at } = req.user;
      res.json({ id, full_name, email, role, status, created_at });
    },
    async available(_req, res) {
      res.json(await schools.available());
    },
    async associations(req, res) {
      res.json(await schools.list(req.user.id));
    },
    async declare(req, res) {
      const { created, association } = await schools.declare(req.user.id, req.body);
      res.status(created ? 201 : 200).json(association);
    },
    async associationStatus(req, res) {
      res.json(await schools.changeStatus(req.user.id, req.params.id, req.body));
    },
    async list(req, res) {
      res.json(await resources.list(req.user.id, req.query));
    },
    async create(req, res) {
      res.status(201).json(await resources.create(req.user, req.body));
    },
    async detail(req, res) {
      res.json(await resources.detail(req.user.id, req.params.id));
    },
    async reviews(req, res) {
      res.json(await resources.reviews(req.user.id, req.params.id));
    },
    async patch(req, res) {
      res.json(await resources.patch(req.user.id, req.params.id, req.body));
    },
    async copy(req, res) {
      res.status(201).json(await resources.copy(req.user.id, req.params.id, req.body));
    },
    async checkUpload(req, _res, next) {
      await resources.checkUpload(req.user.id, req.params.id);
      next();
    },
    async upload(req, res) {
      res.json(await resources.upload(req.user.id, req.params.id, req.file.buffer));
    },
    async submit(req, res) {
      res.status(201).json(await resources.submit(req.user.id, req.params.id));
    }
  };
}

module.exports = { createTeacherController };
