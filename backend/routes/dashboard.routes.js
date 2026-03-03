const router = require("express").Router();
const controller = require("../controllers/dashboard.controller");

router.get("/", controller.getDashboardStats);

module.exports = router;