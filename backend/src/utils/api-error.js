class ApiError extends Error {
  constructor(status, code, message, cause) {
    super(message, { cause });
    this.status = status;
    this.code = code;
  }
}

module.exports = { ApiError };
