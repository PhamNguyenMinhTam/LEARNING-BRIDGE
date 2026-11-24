const express = require('express');
const path = require('node:path');
const cors = require('cors');
const { publicRoutes } = require('./routes/public.routes');
const { schoolReviewRoutes } = require('./routes/review.routes');
const { teacherRoutes } = require('./routes/teacher.routes');
const { governmentRoutes } = require('./routes/government.routes');
const { authRoutes } = require('./routes/auth.routes');
const { healthRoutes } = require('./routes/health.routes');
const { notFound } = require('./middlewares/notFound.middleware');
const { errorHandler } = require('./middlewares/error.middleware');

function createApp({
  nodeEnv = 'production', corsOrigins = [], checkDatabase, auth, government, teacher, reviews, publicResources, serveUi = false, trustProxy = false
} = {}) {
  const app = express();
  app.set('env', nodeEnv);
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'SAMEORIGIN'
    });
    next();
  });
  app.set('trust proxy', trustProxy);
  if (auth) {
    const sessionOptions = { ...auth, secure: nodeEnv === 'production' };
    app.use('/api/auth', authRoutes(sessionOptions));
    if (government) app.use('/api/government', governmentRoutes(sessionOptions, government, reviews));
    if (reviews) app.use('/api/school', schoolReviewRoutes(sessionOptions, reviews));
    if (teacher) app.use('/api/teacher', teacherRoutes(sessionOptions, teacher));
  }
  app.use('/api', cors({
    origin: (origin, callback) => callback(null, corsOrigins.includes(origin)),
    credentials: false,
    methods: ['GET', 'HEAD'],
    allowedHeaders: ['Content-Type']
  }));
  if (publicResources) app.use('/api/public', publicRoutes(publicResources));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', healthRoutes({ nodeEnv, checkDatabase }));
  if (serveUi) {
    const root = path.resolve(__dirname, '../..');
    for (const directory of ['teacher', 'school', 'gorvernment', 'student', 'frontend-shared']) {
      app.use('/' + directory, express.static(path.join(root, directory), { dotfiles: 'deny' }));
    }
    app.get('/', (_req, res) => res.redirect('/student/'));
  }
  app.use(notFound);
  app.use(errorHandler(nodeEnv));
  return app;
}

module.exports = { createApp };
