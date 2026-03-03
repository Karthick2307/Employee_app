const express = require("express");
const router = express.Router();
const controller = require("../controllers/employee.controller");
const upload = require("../middleware/upload");
const { auth, isAdmin } = require("../middleware/auth");

/* ================= PUBLIC (LOGGED-IN USERS) ================= */

// ✅ GET ALL EMPLOYEES (TABLE DATA)
router.get("/", auth, controller.getEmployees);

// ✅ EXPORT EXCEL (MUST BE BEFORE :id)
router.get("/export/excel", auth, isAdmin, controller.exportEmployeesExcel);

// ✅ GET SINGLE EMPLOYEE
router.get("/:id", auth, controller.getEmployeeById);

/* ================= ADMIN ONLY ================= */

// ✅ CREATE EMPLOYEE
router.post(
  "/",
  auth,
  isAdmin,
  upload.single("photo"),
  controller.createEmployee
);

// ✅ UPDATE EMPLOYEE
router.put(
  "/:id",
  auth,
  isAdmin,
  upload.single("photo"),
  controller.updateEmployee
);

// ✅ DELETE EMPLOYEE
router.delete("/:id", auth, isAdmin, controller.deleteEmployee);

// ✅ STATUS TOGGLE
router.patch("/:id/status", auth, isAdmin, controller.toggleEmployeeStatus);

module.exports = router;