const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envCandidates = [
  path.resolve(__dirname, "..", ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
];

envCandidates.forEach((candidatePath) => {
  if (fs.existsSync(candidatePath)) {
    dotenv.config({ path: candidatePath, override: false });
  }
});

const normalizeText = (value) => String(value || "").trim();
const parsePositiveInt = (value, fallback) => {
  const parsedValue = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};
const parseCsv = (value) =>
  normalizeText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const env = {
  nodeEnv: normalizeText(process.env.NODE_ENV).toLowerCase() || "development",
  port: parsePositiveInt(process.env.PORT, 5000),
  mongodbUri: normalizeText(process.env.MONGODB_URI || process.env.MONGO_URI),
  jwtSecret: normalizeText(process.env.JWT_SECRET),
  jwtExpiresIn: normalizeText(process.env.JWT_EXPIRES_IN) || "30d",
  corsOrigins: parseCsv(process.env.CORS_ORIGIN),
  loginRateLimitWindowMinutes: parsePositiveInt(
    process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES,
    15
  ),
  loginRateLimitMaxAttemptsDev: parsePositiveInt(
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_DEV,
    100
  ),
  loginRateLimitMaxAttemptsProd: parsePositiveInt(
    process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PROD,
    5
  ),
  requestLogEnabled:
    normalizeText(process.env.REQUEST_LOG_ENABLED || "true").toLowerCase() !== "false",
  uploadDir: path.resolve(__dirname, "..", "uploads"),
};

const validateEnv = ({ allowMissingCors = false } = {}) => {
  const missing = [];

  if (!env.mongodbUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (!allowMissingCors && !env.corsOrigins.length) missing.push("CORS_ORIGIN");

  if (missing.length) {
    const error = new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    error.status = 500;
    throw error;
  }

  return env;
};

module.exports = {
  env,
  validateEnv,
};
