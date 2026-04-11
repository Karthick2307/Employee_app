const express = require("express");
const router = express.Router();
const {
  login,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/auth.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

router.post("/login", login);
router.get("/users", auth, requirePermission("user_management", "view"), getUsers);
router.post("/users", auth, requirePermission("user_management", "add"), createUser);
router.put("/users/:id", auth, requirePermission("user_management", "edit"), updateUser);
router.delete("/users/:id", auth, requirePermission("user_management", "delete"), deleteUser);

module.exports = router;
