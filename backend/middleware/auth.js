const jwt = require("jsonwebtoken");

/**
 * AUTH MIDDLEWARE
 * Checks JWT token
 */
exports.auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // 1️⃣ Check header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  try {
    // 2️⃣ Extract token
    const token = authHeader.split(" ")[1];

    // 3️⃣ Verify token
    const decoded = jwt.verify(token, "secret123"); // MUST MATCH login secret

    // 4️⃣ Attach user to request
    req.user = decoded; // { id, role, email }

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