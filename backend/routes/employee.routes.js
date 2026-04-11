const express = require("express");
const router = express.Router();
const controller = require("../controllers/employee.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");

/* ================= PUBLIC (LOGGED-IN USERS) ================= */

// ✅ GET ALL EMPLOYEES (TABLE DATA)
router.get("/", auth, requirePermission("employee_master", "view"), controller.getEmployees);

// ✅ EXPORT EXCEL (MUST BE BEFORE :id)
router.get("/export/excel", auth, requirePermission("employee_master", "export"), controller.exportEmployeesExcel);

// ✅ GET SINGLE EMPLOYEE
router.get(
  "/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "employee_master", actionKey: "view" },
    { moduleKey: "own_profile", actionKey: "view" },
  ]),
  controller.getEmployeeById
);

/* ================= ADMIN ONLY ================= */

// ✅ CREATE EMPLOYEE
router.post(
  "/",
  auth,
  requirePermission("employee_master", "add"),
  upload.single("photo"),
  controller.createEmployee
);

// ✅ UPDATE EMPLOYEE
router.put(
  "/:id",
  auth,
  requirePermission("employee_master", "edit"),
  upload.single("photo"),
  controller.updateEmployee
);

// ✅ DELETE EMPLOYEE
router.post("/bulk-delete", auth, requirePermission("employee_master", "delete"), controller.bulkDeleteEmployees);
router.delete("/:id", auth, requirePermission("employee_master", "delete"), controller.deleteEmployee);

// ✅ STATUS TOGGLE
router.patch("/:id/status", auth, requirePermission("employee_master", "status_update"), controller.toggleEmployeeStatus);

module.exports = router;
