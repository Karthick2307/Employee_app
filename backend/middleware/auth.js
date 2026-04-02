const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

const verifyAuthToken = (token) => jwt.verify(token, JWT_SECRET);

/**
 * AUTH MIDDLEWARE
 * Checks JWT token
 */
exports.auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyAuthToken(token);

    req.user = decoded;
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
