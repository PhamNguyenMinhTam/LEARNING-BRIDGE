const multer = require('multer');
const { ApiError } = require('../utils/api-error');

function pdfUpload(maxSize) {
  const parse = multer({ limits: { fileSize: maxSize + 1, files: 1, fields: 0 } }).single('file');
  let inProgress = 0;

  return (req, res, next) => {
    if (inProgress >= 4) return next(new ApiError(429, 'UPLOAD_BUSY', 'Too many concurrent uploads'));
    if (!req.is('multipart/form-data')) return next(new ApiError(400, 'INVALID_UPLOAD', 'Expected multipart PDF upload'));
    inProgress++;
    res.once('close', () => { inProgress--; });
    parse(req, res, error => {
      if (error?.code === 'LIMIT_FILE_SIZE' || req.file?.size > maxSize) {
        return next(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'PDF is too large'));
      }
      if (error || !req.file || req.file.mimetype !== 'application/pdf') {
        return next(new ApiError(400, 'INVALID_UPLOAD', 'Expected a single PDF file'));
      }
      next();
    });
  };
}

module.exports = { pdfUpload };
