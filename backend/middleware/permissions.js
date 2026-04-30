const { hasModulePermission } = require("../services/permissionResolver.service");

const requirePermission = (moduleKey, actionKey = "view") => (req, res, next) => {
  if (hasModulePermission(req.user?.permissions, moduleKey, actionKey)) {
    return next();
  }

  return res.status(403).json({
    message: "You do not have permission to perform this action",
    moduleKey,
    actionKey,
  });
};

const requireAnyPermission = (permissionPairs = []) => (req, res, next) => {
  const hasMatch = permissionPairs.some(({ moduleKey, actionKey = "view" }) =>
    hasModulePermission(req.user?.permissions, moduleKey, actionKey)
  );

  if (hasMatch) {
    return next();
  }

  return res.status(403).json({
    message: "You do not have permission to access this resource",
  });
};

module.exports = {
  requireAnyPermission,
  requirePermission,
};
