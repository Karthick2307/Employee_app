const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const loginRateLimitWindowMinutes = env.loginRateLimitWindowMinutes;
const loginRateLimitMaxAttempts =
  env.nodeEnv === "production"
    ? env.loginRateLimitMaxAttemptsProd
    : env.loginRateLimitMaxAttemptsDev;

const buildLoginRateLimitMessage = () => ({
  success: false,
  message: `Too many authentication attempts. Please try again after ${loginRateLimitWindowMinutes} minutes.`,
  retryAfterMinutes: loginRateLimitWindowMinutes,
});

const authRateLimiter = rateLimit({
  windowMs: loginRateLimitWindowMinutes * 60 * 1000,
  max: loginRateLimitMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.set("Retry-After", String(loginRateLimitWindowMinutes * 60));
    return res.status(429).json(buildLoginRateLimitMessage());
  },
});

module.exports = {
  authRateLimiter,
  buildLoginRateLimitMessage,
  loginRateLimitMaxAttempts,
  loginRateLimitWindowMinutes,
};
