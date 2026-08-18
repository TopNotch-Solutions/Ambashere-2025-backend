const { logError } = require("./errorLogger");

const errorHandler = (err, req, res, next) => {
  logError(err.message, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    user: req.user?.EmployeeCode || req.user?.Email || undefined,
  });

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ message: 'Internal Server Error' });
  } else {
    res.status(500).json({ message: err.message, stack: err.stack });
  }
};

module.exports = errorHandler;