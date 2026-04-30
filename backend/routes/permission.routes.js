const express = require("express");
const {
  createRole,
  getCurrentPermissionProfile,
  getPermissionSetup,
  savePrincipalAccess,
  savePrincipalOverrides,
  saveRolePermissions,
  updateRole,
} = require("../controllers/permission.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

router.get("/me", auth, getCurrentPermissionProfile);
router.get(
  "/setup",
  auth,
  requirePermission("role_permission_setup", "view"),
  getPermissionSetup
);
router.post(
  "/roles",
  auth,
  requirePermission("role_permission_setup", "add"),
  createRole
);
router.put(
  "/roles/:id",
  auth,
  requirePermission("role_permission_setup", "edit"),
  updateRole
);
router.put(
  "/roles/:id/permissions",
  auth,
  requirePermission("role_permission_setup", "edit"),
  saveRolePermissions
);
router.put(
  "/principals/:principalType/:principalId/access",
  auth,
  requirePermission("role_permission_setup", "edit"),
  savePrincipalAccess
);
router.put(
  "/principals/:principalType/:principalId/overrides",
  auth,
  requirePermission("role_permission_setup", "edit"),
  savePrincipalOverrides
);

module.exports = router;
