const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { createPublicResourceController } = require('../controllers/public-resource.controller');
const { ApiError } = require('../utils/api-error');

function publicRoutes(service) {
  const router = Router();
  const controller = createPublicResourceController(service);
  const scanLimit = rateLimit({
    windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'))
  });

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/filters', scanLimit, controller.filters);
  router.get('/resources', scanLimit, controller.list);
  router.get('/resources/:id', controller.detail);
  router.get('/resources/:id/download', controller.download);
  router.get('/resources/:id/preview', controller.preview);
  router.get('/resources/:id/external-link', controller.external);
  return router;
}

module.exports = { publicRoutes };
