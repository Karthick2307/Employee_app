const express = require("express");
const router = express.Router();
const {
  login,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/auth.controller");
const { auth, isAdmin } = require("../middleware/auth");

router.post("/login", login);
router.get("/users", auth, isAdmin, getUsers);
router.post("/users", auth, isAdmin, createUser);
router.put("/users/:id", auth, isAdmin, updateUser);
router.delete("/users/:id", auth, isAdmin, deleteUser);

module.exports = router;
