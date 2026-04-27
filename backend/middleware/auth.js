const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");
const User = require("../models/User");
const { env } = require("../config/env");
const { createHttpError } = require("../utils/httpError");
const { buildSessionUserPayload, resolvePrincipalAccess } = require("../services/permissionResolver.service");

const JWT_SECRET = env.jwtSecret;
const JWT_EXPIRES_IN = env.jwtExpiresIn;

const verifyAuthToken = (token) => jwt.verify(token, JWT_SECRET);

/**
 * AUTH MIDDLEWARE
 * Checks JWT token
 */
const getPrincipalTypeFromToken = (decoded = {}) => {
  const explicitPrincipalType = String(decoded?.principalType || "").trim().toLowerCase();
  if (explicitPrincipalType === "employee" || explicitPrincipalType === "user") {
    return explicitPrincipalType;
  }

  return String(decoded?.role || "").trim().toLowerCase() === "employee" ? "employee" : "user";
};

const buildPrincipalQuery = (principalType) => {
  if (principalType === "employee") {
    return (id) => Employee.findOne({ _id: id, isActive: { $ne: false } });
  }

  return (id) => User.findOne({ _id: id, isActive: { $ne: false } });
};

exports.auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(createHttpError("No token provided", 401));
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyAuthToken(token);
    const principalType = getPrincipalTypeFromToken(decoded);
    const loadPrincipal = buildPrincipalQuery(principalType);
    const principalQuery = loadPrincipal(decoded.id);

    if (principalType === "user") {
      principalQuery.populate("site", "name companyName");
    }

    const principal = await principalQuery.lean();

    if (!principal) {
      return next(createHttpError("Invalid or expired token", 401));
    }

    const access = await resolvePrincipalAccess({ principalType, principal });

    req.access = access;
    req.user = {
      ...decoded,
      ...buildSessionUserPayload({ principalType, principal, access }),
      permissions: access.permissions,
    };
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return next(createHttpError("Invalid or expired token", 401));
  }
};

/**
 * ADMIN ONLY MIDDLEWARE
 */
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return next(createHttpError("Admin only access", 403));
  }
  next();
};

exports.verifyAuthToken = verifyAuthToken;
exports.JWT_SECRET = JWT_SECRET;
exports.JWT_EXPIRES_IN = JWT_EXPIRES_IN;
