const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * LOGIN
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    // ✅ DEBUG (keep during development)
    console.log("REQ BODY:", req.body);

    const { email, password } = req.body;

    // 1️⃣ Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 2️⃣ Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 3️⃣ Compare password (bcrypt)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 4️⃣ Create JWT token
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role, // 🔐 IMPORTANT
        email: user.email,
      },
      "secret123", // ⚠️ later move to .env
      { expiresIn: "1d" }
    );

    // 5️⃣ Send response
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name || "",
        email: user.email,
        role: user.role, // admin | user
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};