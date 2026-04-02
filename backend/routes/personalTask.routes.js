const router = require("express").Router();
const { auth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const {
  completePersonalTask,
  createPersonalTask,
  getShareableEmployees,
  getMyPersonalTaskNotifications,
  getMyPersonalTasks,
  getPersonalTaskById,
  markPersonalTaskNotificationRead,
  sharePersonalTask,
} = require("../controllers/personalTask.controller");

router.get("/", auth, getMyPersonalTasks);
router.get("/notifications", auth, getMyPersonalTaskNotifications);
router.get("/shareable-employees", auth, getShareableEmployees);
router.get("/:id", auth, getPersonalTaskById);
router.post("/", auth, upload.single("attachment"), createPersonalTask);
router.post("/:id/share", auth, sharePersonalTask);
router.post("/:id/read", auth, markPersonalTaskNotificationRead);
router.patch("/:id/complete", auth, completePersonalTask);

module.exports = router;
