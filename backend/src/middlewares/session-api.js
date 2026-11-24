const { Router } = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { ApiError } = require('../utils/api-error');

function createSessionRouter({ origins, secure }, methods) {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (secure && !req.secure) throw new ApiError(403, 'HTTPS_REQUIRED', 'HTTPS required');
    next();
  });
  router.use(cors({
    origin: (origin, callback) => callback(null, origins.includes(origin)),
    credentials: true,
    methods,
    allowedHeaders: ['Content-Type']
  }));
  return router;
}

function accountRateLimit(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'))
  });
}

module.exports = { createSessionRouter, accountRateLimit };
