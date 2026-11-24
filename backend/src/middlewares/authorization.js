const { ApiError } = require('../utils/api-error');
const { sessionAction } = require('../config/session');

function unauthorized() {
  return new ApiError(401, 'AUTH_REQUIRED', 'Authentication required');
}

function forbidden() {
  return new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
}

function requireAuth(auth, clearCookie) {
  return async (req, res, next) => {
    if (!req.session?.userId) throw unauthorized();
    const user = await auth.activeProfile(req.session.userId);
    if (!user) {
      await sessionAction(req, 'destroy');
      clearCookie(res);
      throw unauthorized();
    }
    req.user = user;
    next();
  };
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

function requireSchoolScope({ getTargetSchoolId, findSchoolById }) {
  return async (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (req.user.role !== 'school_admin' || !req.user.school_id) throw forbidden();

    // getTargetSchoolId must derive the scope from a server-loaded record.
    const targetId = await getTargetSchoolId(req);
    if (targetId == null || String(targetId) !== req.user.school_id) throw forbidden();
    const school = await findSchoolById(req.user.school_id);
    if (school?.status !== 'active') throw forbidden();
    next();
  };
}

module.exports = { requireAuth, requireRole, requireSchoolScope };
