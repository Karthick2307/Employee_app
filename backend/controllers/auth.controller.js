const User = require("../models/User");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../middleware/auth");
const DEFAULT_ADMIN_EMAIL = "admin@test.com";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => String(value?._id || value || "").trim();

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;

  return ["true", "1", "yes", "on"].includes(normalized);
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatSiteDisplayName = (site) => {
  if (!site) return "";

  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

const buildSiteSummary = (site) => ({
  siteId: normalizeId(site),
  siteName: String(site?.name || "").trim(),
  siteCompanyName: String(site?.companyName || "").trim(),
  siteDisplayName: formatSiteDisplayName(site),
});

const isDefaultAdminAccount = (account) => {
  if (!account) return false;

  if (typeof account.isDefaultAdmin === "boolean") {
    return account.isDefaultAdmin;
  }

  return normalizeEmail(account.email) === DEFAULT_ADMIN_EMAIL;
};

const ensureDefaultAdminFlag = async (account) => {
  if (!account || typeof account.save !== "function") {
    return account;
  }

  if (!account.isDefaultAdmin && normalizeEmail(account.email) === DEFAULT_ADMIN_EMAIL) {
    account.isDefaultAdmin = true;
    await account.save();
  }

  return account;
};

const buildLoginResponse = (account, accountType = "user") => {
  if (accountType === "employee") {
    return {
      id: account._id,
      name: account.employeeName || "",
      email: account.email || account.employeeCode || "",
      employeeCode: account.employeeCode || "",
      role: "employee",
      isDefaultAdmin: false,
      checklistMasterAccess: false,
      siteId: "",
      siteName: "",
      siteCompanyName: "",
      siteDisplayName: "",
    };
  }

  const hasChecklistMasterAccess =
    account.role === "user"
      ? account.checklistMasterAccess !== false
      : Boolean(account.checklistMasterAccess);
  const siteSummary = buildSiteSummary(account.site);

  return {
    id: account._id,
    name: account.name || "",
    email: account.email,
    role: account.role,
    isDefaultAdmin: isDefaultAdminAccount(account),
    checklistMasterAccess: hasChecklistMasterAccess,
    ...siteSummary,
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
    const user = await User.findOne({ email: normalizedLoginId }).populate(
      "site",
      "name companyName"
    );

    if (user) {
      const isUserPasswordMatch = await bcrypt.compare(password, user.password);

      if (isUserPasswordMatch) {
        await ensureDefaultAdminFlag(user);

        const token = jwt.sign(
          {
            id: user._id,
            role: user.role,
            email: user.email,
            checklistMasterAccess:
              user.role === "user"
                ? user.checklistMasterAccess !== false
                : Boolean(user.checklistMasterAccess),
            siteId: normalizeId(user.site),
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
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
      { expiresIn: JWT_EXPIRES_IN }
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
    const users = await User.find(
      {},
      "name email role checklistMasterAccess site createdAt updatedAt isDefaultAdmin"
    )
      .populate("site", "name companyName")
      .sort({
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
    const { name, email, password } = req.body;
    const siteId = normalizeId(req.body.siteId || req.body.site);

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

    if (!siteId) {
      return res.status(400).json({
        message: "Site is required for Checklist Master users",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = "user";

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({
        message: "User already exists with this email",
      });
    }

    const site = await Site.findById(siteId, "name companyName");
    if (!site) {
      return res.status(400).json({
        message: "Selected site is invalid",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      site: site._id,
      role: normalizedRole,
      checklistMasterAccess: true,
    });

    await user.populate("site", "name companyName");

    return res.status(201).json({
      message: "Checklist Master user created",
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
    const requestedSiteId = normalizeId(req.body.siteId || req.body.site);

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

    await ensureDefaultAdminFlag(user);

    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = role === "admin" ? "admin" : "user";
    const isSelf = String(req.user?.id) === String(user._id);
    const requester = isSelf
      ? user
      : await User.findById(req.user?.id).select("email isDefaultAdmin");

    if (isDefaultAdminAccount(requester) && user.role !== "admin" && normalizedRole === "admin") {
      return res.status(403).json({
        message: "Default Admin cannot promote a user to admin",
      });
    }

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
    if (normalizedRole === "admin") {
      user.site = null;
    } else {
      const nextSiteId = requestedSiteId || normalizeId(user.site);

      if (!nextSiteId) {
        return res.status(400).json({
          message: "Site is required for Checklist Master users",
        });
      }

      const site = await Site.findById(nextSiteId, "_id");
      if (!site) {
        return res.status(400).json({
          message: "Selected site is invalid",
        });
      }

      user.site = site._id;
    }
    user.checklistMasterAccess =
      normalizedRole === "admin"
        ? false
        : parseBoolean(req.body?.checklistMasterAccess, user.checklistMasterAccess);

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    await user.populate("site", "name companyName");

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
