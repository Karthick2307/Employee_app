const router = require("express").Router();
const { auth, isAdmin } = require("../middleware/auth");
const {
  createFeedback,
  getAdminFeedbackNotifications,
  markAdminFeedbackNotificationRead,
  markAllAdminFeedbackNotificationsRead,
} = require("../controllers/feedback.controller");

router.get("/notifications", auth, isAdmin, getAdminFeedbackNotifications);
router.post(
  "/notifications/read-all",
  auth,
  isAdmin,
  markAllAdminFeedbackNotificationsRead
);
router.post("/:id/read", auth, isAdmin, markAdminFeedbackNotificationRead);
router.post("/", auth, createFeedback);

module.exports = router;
