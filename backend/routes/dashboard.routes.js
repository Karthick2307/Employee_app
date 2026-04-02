const router = require("express").Router();
const controller = require("../controllers/dashboard.controller");
const { auth } = require("../middleware/auth");

if (typeof controller.getWelcomeSummary === "function") {
  router.get("/welcome-summary", auth, controller.getWelcomeSummary);
}

if (typeof controller.getEmployeeMarkDrilldown === "function") {
  router.get("/employee-marks/drilldown", auth, controller.getEmployeeMarkDrilldown);
}

if (typeof controller.getCompanySiteEmployeeMarkDrilldown === "function") {
  router.get("/company-site-marks/drilldown", auth, controller.getCompanySiteEmployeeMarkDrilldown);
}

if (typeof controller.getDashboardHierarchicalMarkSummary === "function") {
  router.get("/hierarchical-marks/summary", auth, controller.getDashboardHierarchicalMarkSummary);
}

router.get("/", auth, controller.getDashboardStats);

module.exports = router;
