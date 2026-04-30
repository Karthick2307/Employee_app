const router = require("express").Router();
const controller = require("../controllers/dashboard.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

if (typeof controller.getWelcomeSummary === "function") {
  router.get("/welcome-summary", auth, controller.getWelcomeSummary);
}

if (typeof controller.getEmployeeMarkDrilldown === "function") {
  router.get(
    "/employee-marks/drilldown",
    auth,
    requirePermission("dashboard_analytics", "view"),
    controller.getEmployeeMarkDrilldown
  );
}

if (typeof controller.getCompanySiteEmployeeMarkDrilldown === "function") {
  router.get(
    "/company-site-marks/drilldown",
    auth,
    requirePermission("dashboard_analytics", "view"),
    controller.getCompanySiteEmployeeMarkDrilldown
  );
}

if (typeof controller.getDashboardHierarchicalMarkSummary === "function") {
  router.get(
    "/hierarchical-marks/summary",
    auth,
    requirePermission("dashboard_analytics", "view"),
    controller.getDashboardHierarchicalMarkSummary
  );
}

router.get("/", auth, requirePermission("dashboard", "view"), controller.getDashboardStats);

module.exports = router;
