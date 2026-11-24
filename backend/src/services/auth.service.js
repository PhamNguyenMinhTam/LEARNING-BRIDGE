const {
  hashPassword, verifyPassword, normalizeEmail, validPassword, registrationFields, invalidCredentials
} = require('./credentials');

function publicProfile({ id, full_name, email, role, status, school_id }) {
  return { id: String(id), full_name, email, role, status, school_id: school_id == null ? null : String(school_id) };
}

function createAuthService(users) {
  return {
    async register(fields) {
      const { full_name, email, password } = registrationFields(fields);
      const password_hash = await hashPassword(password);
      return publicProfile(await users.create({ full_name, email, password_hash }, 'teacher'));
    },
    async authenticate({ email, password } = {}) {
      const normalized = normalizeEmail(email);
      if (!normalized || !validPassword(password)) throw invalidCredentials();

      const user = await users.findByEmail(normalized);
      const verified = await verifyPassword(user?.password_hash, password);
      if (!verified || user.status !== 'active') throw invalidCredentials();
      return publicProfile(user);
    },
    async activeProfile(id) {
      const user = await users.findById(id);
      return user?.status === 'active' ? { ...publicProfile(user), created_at: user.created_at } : null;
    }
  };
}

module.exports = { createAuthService };
