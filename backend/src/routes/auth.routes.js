const { json } = require('express');
const { createSessionMiddleware } = require('../config/session');
const { createAuthController } = require('../controllers/auth.controller');
const { requireTrustedOrigin } = require('../middlewares/auth-origin');
const { requireAuth } = require('../middlewares/authorization');
const { createSessionRouter, accountRateLimit } = require('../middlewares/session-api');

function authRoutes({ origins, auth, ...sessionConfig }) {
  const router = createSessionRouter({ origins, secure: sessionConfig.secure }, ['GET', 'HEAD', 'POST']);
  const session = createSessionMiddleware(sessionConfig);
  const controller = createAuthController(auth, session.clear);
  const parseJson = json({ limit: '32kb' });

  router.use(requireTrustedOrigin(origins));

  router.post('/register', accountRateLimit(5), parseJson, controller.register);
  router.post('/login', accountRateLimit(10), parseJson, session.load, controller.login);
  router.post('/logout', session.load, controller.logout);
  router.get('/me', session.load, requireAuth(auth, session.clear), controller.me);
  return router;
}

module.exports = { authRoutes };
