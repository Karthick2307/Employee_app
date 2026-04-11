const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const chatUpload = require("../middleware/chatUpload");
const chatController = require("../controllers/chat.controller");

router.get("/stream", auth, requirePermission("site_chat", "view"), chatController.stream);

router.use(auth, requirePermission("site_chat", "view"));

router.get("/groups", chatController.listGroups);
router.get("/groups/:groupId/messages", chatController.getMessages);
router.post(
  "/groups/:groupId/messages",
  requirePermission("site_chat", "add"),
  chatUpload.fields([
    { name: "attachment", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  chatController.sendMessage
);
router.patch("/groups/:groupId/messages/:messageId", requirePermission("site_chat", "edit"), chatController.updateMessage);
router.delete("/groups/:groupId/messages/:messageId", requirePermission("site_chat", "delete"), chatController.deleteMessage);
router.post("/groups/:groupId/read", chatController.markRead);
router.get("/notifications", chatController.getNotifications);

module.exports = router;
