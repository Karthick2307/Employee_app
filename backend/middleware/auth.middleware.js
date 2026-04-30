const { auth, isAdmin } = require("./auth");

exports.protect = auth;
exports.adminOnly = isAdmin;
