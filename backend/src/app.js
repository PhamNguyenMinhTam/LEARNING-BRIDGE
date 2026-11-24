const express = require('express');
const cors = require('cors');
const { teacherRoutes } = require('./routes/teacher.routes');
const { governmentRoutes } = require('./routes/government.routes');
const { authRoutes } = require('./routes/auth.routes');
const { healthRoutes } = require('./routes/health.routes');
const { notFound } = require('./middlewares/notFound.middleware');
const { errorHandler } = require('./middlewares/error.middleware');

function createApp({
  nodeEnv = 'production', corsOrigins = [], checkDatabase, auth, government, teacher, trustProxy = false
} = {}) {
  const app = express();
  app.set('env', nodeEnv);
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  if (auth) {
    const sessionOptions = { ...auth, secure: nodeEnv === 'production' };
    app.use('/api/auth', authRoutes(sessionOptions));
    if (government) app.use('/api/government', governmentRoutes(sessionOptions, government));
    if (teacher) app.use('/api/teacher', teacherRoutes(sessionOptions, teacher));
  }
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
