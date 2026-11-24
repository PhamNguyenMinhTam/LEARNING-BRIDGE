const { Router } = require('express');
const { health, databaseHealth } = require('../controllers/health.controller');
const { notFound } = require('../middlewares/notFound.middleware');

function healthRoutes({ nodeEnv, checkDatabase }) {
  const router = Router();
  router.get('/health', health);

  if (nodeEnv === 'development' && checkDatabase) {
    const check = databaseHealth(checkDatabase);
    router.get('/health/db', (req, res, next) => {
      const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
      if (!loopback.includes(req.socket.remoteAddress)) return notFound(req, res, next);
      return check(req, res);
    });
  }
  return router;
}

module.exports = { healthRoutes };
