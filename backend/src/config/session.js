const session = require('express-session');
const { ApiError } = require('../utils/api-error');

function sessionUnavailable(cause) {
  return new ApiError(503, 'SESSION_UNAVAILABLE', 'Session storage unavailable', cause);
}

function createSessionMiddleware({ secret, name, maxAge, secure, store }) {
  if (!store || (secure && store instanceof session.MemoryStore)) {
    throw new Error('A persistent session store is required in production');
  }
  const cookie = { path: '/api', httpOnly: true, sameSite: 'lax', secure };
  const load = session({
    secret, name, store, cookie: { ...cookie, maxAge },
    resave: false, saveUninitialized: false, rolling: true
  });

  return {
    load: (req, res, next) => load(req, res, error => next(error ? sessionUnavailable(error) : undefined)),
    clear: res => res.clearCookie(name, cookie)
  };
}

function sessionAction(req, action) {
  return new Promise((resolve, reject) => {
    req.session[action](error => error ? reject(sessionUnavailable(error)) : resolve());
  });
}

module.exports = { createSessionMiddleware, sessionAction };
