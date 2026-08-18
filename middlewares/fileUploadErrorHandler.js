const multer = require("multer");
const { logError } = require("./errorLogger");

const isFileRelatedError = (err) =>
  err instanceof multer.MulterError ||
  /file|upload|multer|excel|pdf|image|spreadsheet|ENOENT|EACCES|EPERM/i.test(
    err?.message || ""
  );

const handleFileUploadError = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (isFileRelatedError(err)) {
    logError("File error", {
      stack: err.stack,
      message: err.message,
      code: err.code,
      field: err.field,
      method: req.method,
      url: req.originalUrl,
      fileName: req.file?.originalname,
    });

    const status = err instanceof multer.MulterError ? 400 : 500;
    return res.status(status).json({
      message: err.message || "File operation failed",
    });
  }

  next(err);
};

const wrapMulter = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      logError("File upload error", {
        stack: err.stack,
        message: err.message,
        code: err.code,
        method: req.method,
        url: req.originalUrl,
      });
      const status = err instanceof multer.MulterError ? 400 : 500;
      return res.status(status).json({
        message: err.message || "File upload failed",
      });
    }
    next();
  });
};

module.exports = { handleFileUploadError, wrapMulter, isFileRelatedError };
