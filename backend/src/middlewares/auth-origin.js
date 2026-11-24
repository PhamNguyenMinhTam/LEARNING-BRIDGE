const { ApiError } = require('../utils/api-error');

function requireTrustedOrigin(origins) {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!origins.includes(req.get('Origin'))) {
      throw new ApiError(403, 'ORIGIN_DENIED', 'Request origin is not allowed');
    }
    next();
  };
}

module.exports = { requireTrustedOrigin };
