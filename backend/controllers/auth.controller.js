const User = require("../models/User");
const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "secret123";

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildLoginResponse = (account, accountType = "user") => {
  if (accountType === "employee") {
    return {
      id: account._id,
      name: account.employeeName || "",
      email: account.email || account.employeeCode || "",
      employeeCode: account.employeeCode || "",
      role: "employee",
    };
  }

  return {
    id: account._id,
    name: account.name || "",
    email: account.email,
    role: account.role,
  };
};

const countAdmins = () => User.countDocuments({ role: "admin" });

exports.login = async (req, res) => {
  try {
    const loginId = String(req.body.loginId || req.body.email || "").trim();
    const password = String(req.body.password || "");

    if (!loginId || !password) {
      return res.status(400).json({
        message: "Login ID and password are required",
      });
    }

    const normalizedLoginId = loginId.toLowerCase();
    const user = await User.findOne({ email: normalizedLoginId });

    if (user) {
      const isUserPasswordMatch = await bcrypt.compare(password, user.password);

      if (isUserPasswordMatch) {
        const token = jwt.sign(
          {
            id: user._id,
            role: user.role,
            email: user.email,
          },
          JWT_SECRET,
          { expiresIn: "1d" }
        );

        return res.json({
          token,
          user: buildLoginResponse(user),
        });
      }
    }

    const employee = await Employee.findOne({
      isActive: true,
      $or: [
        { employeeCode: { $regex: `^${escapeRegex(loginId)}$`, $options: "i" } },
        { employeeName: { $regex: `^${escapeRegex(loginId)}$`, $options: "i" } },
        { email: { $regex: `^${escapeRegex(loginId)}$`, $options: "i" } },
      ],
    }).select("+password");

    if (!employee || !employee.password) {
      return res.status(401).json({
        message: "Invalid login ID or password",
      });
    }

    const isEmployeePasswordMatch = await bcrypt.compare(password, employee.password);
    if (!isEmployeePasswordMatch) {
      return res.status(401).json({
        message: "Invalid login ID or password",
      });
    }

    const token = jwt.sign(
      {
        id: employee._id,
        role: "employee",
        email: employee.email || employee.employeeCode || "",
        employeeCode: employee.employeeCode || "",
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      user: buildLoginResponse(employee, "employee"),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, "name email role createdAt").sort({
      createdAt: -1,
    });

    return res.json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    return res.status(500).json({
      message: "Failed to load users",
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role = "user" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role === "admin" ? "admin" : "user",
    });

    return res.status(201).json({
      message: "User created",
      user: buildLoginResponse(user),
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    return res.status(500).json({
      message: "Failed to create user",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, password = "", role = "user" } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    if (password && password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role === "admin" ? "admin" : "user";
    const isSelf = String(req.user?.id) === String(user._id);

    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (existing) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    if (user.role === "admin" && normalizedRole !== "admin") {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        return res.status(400).json({
          message: "At least one admin user must remain",
        });
      }

      if (isSelf) {
        return res.status(400).json({
          message: "You cannot remove your own admin access",
        });
      }
    }

    user.name = name.trim();
    user.email = normalizedEmail;
    user.role = normalizedRole;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.json({
      message: "User updated",
      user: buildLoginResponse(user),
    });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);
    return res.status(500).json({
      message: "Failed to update user",
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (String(req.user?.id) === String(user._id)) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    if (user.role === "admin") {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({
          message: "At least one admin user must remain",
        });
      }
    }

    await User.findByIdAndDelete(user._id);

    return res.json({
      message: "User deleted",
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);
    return res.status(500).json({
      message: "Failed to delete user",
    });
  }
};
