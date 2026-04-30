const multer = require("multer");
const { HttpError, createHttpError } = require("../utils/httpError");

const buildErrorPayload = (payload = {}, fallbackMessage = "Request failed") => ({
  success: false,
  message:
    typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : fallbackMessage,
  errors: Array.isArray(payload.errors) ? payload.errors : [],
  ...payload,
});

const errorResponseNormalizer = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (
      res.statusCode >= 400 &&
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      !Buffer.isBuffer(payload)
    ) {
      return originalJson(buildErrorPayload(payload));
    }

    return originalJson(payload);
  };

  next();
};

const notFoundHandler = (req, res, next) => {
  next(createHttpError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const normalizedError =
    err instanceof HttpError
      ? err
      : err instanceof multer.MulterError
      ? createHttpError(err.message, 400)
      : err
      ? createHttpError(err.message || "Internal server error", err.status || 500, err.errors)
      : createHttpError("Internal server error", 500);

  if (normalizedError.status >= 500) {
    console.error("UNHANDLED ERROR:", err);
  }

  return res.status(normalizedError.status || 500).json({
    success: false,
    message: normalizedError.message || "Internal server error",
    errors: Array.isArray(normalizedError.errors) ? normalizedError.errors : [],
    ...(process.env.NODE_ENV === "development" && err?.stack
      ? { stack: String(err.stack) }
      : {}),
  });
};

module.exports = {
  errorHandler,
  errorResponseNormalizer,
  notFoundHandler,
};
