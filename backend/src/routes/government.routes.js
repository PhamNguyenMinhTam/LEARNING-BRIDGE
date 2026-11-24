const { reviewRoutes } = require('./review.routes');
const { createReviewController } = require('../controllers/review.controller');
const { json } = require('express');
const { createSessionMiddleware } = require('../config/session');
const { createGovernmentController } = require('../controllers/government.controller');
const { requireTrustedOrigin } = require('../middlewares/auth-origin');
const { requireAuth, requireRole } = require('../middlewares/authorization');
const { createSessionRouter, accountRateLimit } = require('../middlewares/session-api');

function governmentRoutes({ origins, auth, ...sessionConfig }, service, reviews) {
  const router = createSessionRouter({ origins, secure: sessionConfig.secure }, ['GET', 'HEAD', 'POST', 'PATCH']);
  const session = createSessionMiddleware(sessionConfig);
  const controller = createGovernmentController(service);
  const parseJson = json({ limit: '32kb' });

  router.use(session.load, requireAuth(auth, session.clear), requireRole('government'), requireTrustedOrigin(origins));
  if (reviews) {
    router.use('/reviews', reviewRoutes(reviews));
    const publication = createReviewController(reviews);
    router.post('/resources/:id/withdraw', parseJson, publication.withdraw);
    router.post('/resources/:id/reinstate', parseJson, publication.reinstate);
  }
  router.get('/schools', controller.listSchools);
  router.get('/schools/:id', controller.getSchool);
  router.post('/schools', parseJson, controller.createSchool);
  router.patch('/schools/:id', parseJson, controller.updateSchoolName);
  router.patch('/schools/:id/status', parseJson, controller.updateSchoolStatus);
  router.patch('/schools/:id/teacher-id-pattern', parseJson, controller.updateTeacherPattern);
  router.get('/schools/:id/admins', controller.listAdmins);
  router.post('/schools/:id/admins', accountRateLimit(10), parseJson, controller.createAdmin);
  router.patch('/admins/:id/status', parseJson, controller.updateAdminStatus);
  return router;
}

module.exports = { governmentRoutes };
