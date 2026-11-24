const { CommitOutcomeUnknown, isDatabaseUnavailable } = require('../repositories/mysql');
const { ApiError } = require('../utils/api-error');

function errorHandler(nodeEnv) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(new Error('Response interrupted'));

    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (error.type === 'entity.parse.failed') {
      [status, code, message] = [400, 'INVALID_JSON', 'Malformed JSON body'];
    } else if (error.type === 'entity.too.large') {
      [status, code, message] = [413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'];
    } else if (error instanceof ApiError) {
      ({ status, code, message } = error);
    } else if (error.status === 404 && error.code === 'NOT_FOUND') {
      [status, code, message] = [404, 'NOT_FOUND', 'Route not found'];
    } else if (error.status === 503 && error.code === 'DATABASE_UNAVAILABLE') {
      [status, code, message] = [503, 'DATABASE_UNAVAILABLE', 'Database unavailable'];
    } else if (isDatabaseUnavailable(error instanceof CommitOutcomeUnknown ? error.cause : error)) {
      [status, code, message] = [503, 'DATABASE_UNAVAILABLE', 'Database unavailable'];
    } else if ([400, 415].includes(error.status)) {
      [status, code, message] = [error.status, 'INVALID_REQUEST', 'Invalid request body'];
    }

    if (nodeEnv === 'development') {
      const causeCode = error.cause?.code ?? error.code;
      const diagnostic = /^(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ER_ACCESS_DENIED_ERROR|ER_BAD_DB_ERROR|ER_DBACCESS_DENIED_ERROR|ER_LOCK_DEADLOCK|ER_LOCK_WAIT_TIMEOUT|PROTOCOL_SEQUENCE_TIMEOUT)$/.test(causeCode)
        ? causeCode : undefined;
      console.error('API request failed', { method: req.method, status, code, diagnostic });
    }

    return res.status(status).json({ error: { code, message } });
  };
}

module.exports = { errorHandler };
