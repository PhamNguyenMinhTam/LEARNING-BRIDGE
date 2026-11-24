const { json } = require('express');
const { createSessionMiddleware } = require('../config/session');
const { createTeacherController } = require('../controllers/teacher.controller');
const { requireTrustedOrigin } = require('../middlewares/auth-origin');
const { requireAuth, requireRole } = require('../middlewares/authorization');
const { createSessionRouter, accountRateLimit } = require('../middlewares/session-api');
const { pdfUpload } = require('../middlewares/upload');

function teacherRoutes({ origins, auth, ...sessionConfig }, { schools, resources, maxSize }) {
  const router = createSessionRouter({ origins, secure: sessionConfig.secure }, ['GET', 'HEAD', 'POST', 'PATCH']);
  const session = createSessionMiddleware(sessionConfig);
  const controller = createTeacherController(schools, resources);
  const parseJson = json({ limit: '32kb' });
  router.use(session.load, requireAuth(auth, session.clear), requireRole('teacher'), requireTrustedOrigin(origins));
  router.get('/profile', controller.profile);
  router.get('/schools/available', controller.available);
  router.get('/schools', controller.associations);
  router.post('/schools', parseJson, controller.declare);
  router.patch('/schools/:id/status', parseJson, controller.associationStatus);
  router.get('/resources', controller.list);
  router.post('/resources', parseJson, controller.create);
  router.get('/resources/:id', controller.detail);
  router.get('/resources/:id/reviews', controller.reviews);
  router.post('/resources/:id/versions', parseJson, controller.copy);
  router.patch('/versions/:id', parseJson, controller.patch);
  router.post('/versions/:id/upload', accountRateLimit(30), controller.checkUpload, pdfUpload(maxSize), controller.upload);
  router.post('/versions/:id/submit', controller.submit);
  return router;
}

module.exports = { teacherRoutes };
