const { Router, json } = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { createSessionMiddleware } = require('../config/session');
const { createAuthController } = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/authorization');
const { requireTrustedOrigin } = require('../middlewares/auth-origin');
const { ApiError } = require('../utils/api-error');

function authLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'))
  });
}

function authRoutes({ origins, auth, ...sessionConfig }) {
  const router = Router();
  const session = createSessionMiddleware(sessionConfig);
  const controller = createAuthController(auth, session.clear);

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use((req, _res, next) => {
    if (sessionConfig.secure && !req.secure) {
      throw new ApiError(403, 'HTTPS_REQUIRED', 'HTTPS required');
    }
    next();
  });
  router.use(cors({
    origin: (origin, callback) => callback(null, origins.includes(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
  router.use(requireTrustedOrigin(origins));
  const parseJson = json({ limit: '32kb' });

  router.post('/register', authLimiter(5), parseJson, controller.register);
  router.post('/login', authLimiter(10), parseJson, session.load, controller.login);
  router.post('/logout', session.load, controller.logout);
  router.get('/me', session.load, requireAuth(auth, session.clear), controller.me);
  return router;
}

module.exports = { authRoutes };
