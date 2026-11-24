function notFound(_req, _res, next) {
  next(Object.assign(new Error('Route not found'), { status: 404, code: 'NOT_FOUND' }));
}

module.exports = { notFound };
