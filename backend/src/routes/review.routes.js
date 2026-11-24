const { Router, json } = require('express');
const { createSessionMiddleware } = require('../config/session');
const { createReviewController } = require('../controllers/review.controller');
const { requireTrustedOrigin } = require('../middlewares/auth-origin');
const { requireAuth, requireRole } = require('../middlewares/authorization');
const { createSessionRouter } = require('../middlewares/session-api');

function reviewRoutes(service) {
  const router = Router();
  const controller = createReviewController(service);
  const parseJson = json({ limit: '32kb' });
  router.get('/pending', controller.pending);
  router.get('/history', controller.history);
  router.get('/:id/preview', controller.preview);
  router.get('/:id', controller.detail);
  router.post('/:id/approve', parseJson, controller.approve);
  router.post('/:id/reject', parseJson, controller.reject);
  return router;
}

function schoolReviewRoutes({ origins, auth, ...sessionConfig }, service) {
  const router = createSessionRouter({ origins, secure: sessionConfig.secure }, ['GET', 'HEAD', 'POST']);
  const session = createSessionMiddleware(sessionConfig);
  router.use(session.load, requireAuth(auth, session.clear), requireRole('school_admin'), requireTrustedOrigin(origins));
  router.use('/reviews', reviewRoutes(service));
  return router;
}

module.exports = { reviewRoutes, schoolReviewRoutes };
