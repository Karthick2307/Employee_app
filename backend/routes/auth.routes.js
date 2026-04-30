const express = require("express");
const {
  login,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { authRateLimiter } = require("../middleware/rateLimit");
const { validateRequest } = require("../middleware/validateRequest");
const {
  createUserSchema,
  idParamSchema,
  loginSchema,
  updateUserSchema,
} = require("../validators/auth.validator");

const router = express.Router();

router.post("/login", authRateLimiter, validateRequest({ body: loginSchema }), login);
router.get("/users", auth, requirePermission("user_management", "view"), getUsers);
router.post(
  "/users",
  auth,
  requirePermission("user_management", "add"),
  validateRequest({ body: createUserSchema }),
  createUser
);
router.put(
  "/users/:id",
  auth,
  requirePermission("user_management", "edit"),
  validateRequest({ params: idParamSchema, body: updateUserSchema }),
  updateUser
);
router.delete(
  "/users/:id",
  auth,
  requirePermission("user_management", "delete"),
  validateRequest({ params: idParamSchema }),
  deleteUser
);

module.exports = router;
