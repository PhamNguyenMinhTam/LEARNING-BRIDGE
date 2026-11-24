const { sessionAction } = require('../config/session');
const { invalidInput } = require('../services/credentials');

function credentials(req) {
  if (!req.is('application/json') || !req.body || Array.isArray(req.body)) throw invalidInput();
  return req.body;
}

function createAuthController(auth, clearCookie) {
  return {
    async register(req, res) {
      const user = await auth.register(credentials(req));
      res.status(201).json(user);
    },
    async login(req, res) {
      const user = await auth.authenticate(credentials(req));
      await sessionAction(req, 'regenerate');
      req.session.userId = user.id;
      req.session.touch();
      try {
        await sessionAction(req, 'save');
      } catch (error) {
        req.session = null;
        throw error;
      }
      res.json(user);
    },
    async logout(req, res) {
      if (req.session?.userId) await sessionAction(req, 'destroy');
      clearCookie(res);
      res.status(204).end();
    },
    me(req, res) {
      const { created_at, ...profile } = req.user;
      res.json(profile);
    }
  };
}

module.exports = { createAuthController };
