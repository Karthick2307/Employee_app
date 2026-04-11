const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee");
const User = require("../models/User");
const { buildSessionUserPayload, resolvePrincipalAccess } = require("../services/permissionResolver.service");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

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
    return (id) => Employee.findById(id);
  }

  return (id) => User.findById(id);
};

exports.auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "No token provided",
    });
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
      return res.status(401).json({
        message: "Invalid or expired token",
      });
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
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

/**
 * ADMIN ONLY MIDDLEWARE
 */
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin only access",
    });
  }
  next();
};

exports.verifyAuthToken = verifyAuthToken;
exports.JWT_SECRET = JWT_SECRET;
exports.JWT_EXPIRES_IN = JWT_EXPIRES_IN;
