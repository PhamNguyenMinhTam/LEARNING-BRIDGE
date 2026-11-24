const express = require('express');
const cors = require('cors');
const { authRoutes } = require('./routes/auth.routes');
const { healthRoutes } = require('./routes/health.routes');
const { notFound } = require('./middlewares/notFound.middleware');
const { errorHandler } = require('./middlewares/error.middleware');

function createApp({
  nodeEnv = 'production', corsOrigins = [], checkDatabase, auth, trustProxy = false
} = {}) {
  const app = express();
  app.set('env', nodeEnv);
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  if (auth) app.use('/api/auth', authRoutes({ ...auth, secure: nodeEnv === 'production' }));
  app.use('/api', cors({
    origin: (origin, callback) => callback(null, corsOrigins.includes(origin)),
    credentials: false,
    methods: ['GET', 'HEAD'],
    allowedHeaders: ['Content-Type']
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', healthRoutes({ nodeEnv, checkDatabase }));
  app.use(notFound);
  app.use(errorHandler(nodeEnv));
  return app;
}

module.exports = { createApp };
