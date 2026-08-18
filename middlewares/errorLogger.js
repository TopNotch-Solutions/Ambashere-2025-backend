const { createLogger, transports, format, Transport } = require('winston');

const originalConsoleError = console.error.bind(console);
let isForwardingConsoleError = false;

const normalizeErrorInfo = (message, errorOrMeta) => {
  if (errorOrMeta instanceof Error) {
    return {
      message: `${message}${message.endsWith(':') ? '' : ':'} ${errorOrMeta.message}`.trim(),
      stack: errorOrMeta.stack,
    };
  }

  if (errorOrMeta && typeof errorOrMeta === 'object') {
    return {
      message,
      stack: errorOrMeta.stack || '',
      ...errorOrMeta,
    };
  }

  if (errorOrMeta !== undefined) {
    return {
      message: `${message} ${String(errorOrMeta)}`.trim(),
      stack: '',
    };
  }

  return { message, stack: '' };
};

class ErrorEmailTransport extends Transport {
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (info.level === 'error') {
      const { sendErrorEmail } = require('./email');
      sendErrorEmail(info).catch((err) => {
        originalConsoleError('Error email transport failed:', err.message);
      });
    }

    callback();
  }
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.errors({ stack: true }),
    format.splat(),
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
    new ErrorEmailTransport({ level: 'error' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    ),
  }));
}

const logError = (message, errorOrMeta) => {
  const info = normalizeErrorInfo(message, errorOrMeta);
  logger.error(info.message, { stack: info.stack, ...info });
};

console.error = (...args) => {
  originalConsoleError(...args);

  if (isForwardingConsoleError) {
    return;
  }

  isForwardingConsoleError = true;
  try {
    const errorArg = args.find((arg) => arg instanceof Error);
    const textParts = args
      .filter((arg) => !(arg instanceof Error))
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)));

    const message = textParts.join(' ').trim() || errorArg?.message || 'Console error';
    logError(message, errorArg);
  } finally {
    isForwardingConsoleError = false;
  }
};

module.exports = logger;
module.exports.logError = logError;
