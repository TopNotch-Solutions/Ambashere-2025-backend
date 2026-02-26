const logger = require("./errorLogger");

const errorHandler = (err, req, res, next) => {
    logger.error(err.message, { stack: err.stack });
  
    if (process.env.NODE_ENV === 'production') {
      res.status(500).json({ message: 'Internal Server Error' });
    } else {
      res.status(500).json({ message: err.message, stack: err.stack });
    }
  };
  
  module.exports = errorHandler;