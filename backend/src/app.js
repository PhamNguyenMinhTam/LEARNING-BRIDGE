const express = require('express');
const cors = require('cors');
const { healthRoutes } = require('./routes/health.routes');
const { notFound } = require('./middlewares/notFound.middleware');
const { errorHandler } = require('./middlewares/error.middleware');

function createApp({ nodeEnv = 'production', corsOrigins = [], checkDatabase } = {}) {
  const app = express();
  app.set('env', nodeEnv);
  app.disable('x-powered-by');
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
