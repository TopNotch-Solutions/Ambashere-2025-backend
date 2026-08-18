const wrapAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const patchExpressAsyncHandlers = (express) => {
  const wrapHandlers = (args) =>
    args.map((handler) => {
      if (typeof handler === "function" && handler.length <= 3) {
        return wrapAsync(handler);
      }
      return handler;
    });

  ["get", "post", "put", "delete", "patch", "all", "use"].forEach((method) => {
    const routerOriginal = express.Router.prototype[method];
    express.Router.prototype[method] = function (...args) {
      return routerOriginal.apply(this, wrapHandlers(args));
    };

    const appOriginal = express.application[method];
    express.application[method] = function (...args) {
      return appOriginal.apply(this, wrapHandlers(args));
    };
  });
};

module.exports = { wrapAsync, patchExpressAsyncHandlers };
