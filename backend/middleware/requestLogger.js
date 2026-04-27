const morgan = require("morgan");
const { env } = require("../config/env");

const buildRequestLogLine = (tokens, req, res) =>
  JSON.stringify({
    time: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res) || 0),
    responseTimeMs: Number(tokens["response-time"](req, res) || 0),
    contentLength: Number(tokens.res(req, res, "content-length") || 0),
    ip: req.ip,
  });

const requestLogger = morgan(buildRequestLogLine, {
  skip: () => !env.requestLogEnabled || env.nodeEnv === "test",
});

module.exports = {
  requestLogger,
};
