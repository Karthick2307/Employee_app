const router = require("express").Router();
const { auth } = require("../middleware/auth");
const chatUpload = require("../middleware/chatUpload");
const chatController = require("../controllers/chat.controller");

router.get("/stream", chatController.stream);

router.use(auth);

router.get("/groups", chatController.listGroups);
router.get("/groups/:groupId/messages", chatController.getMessages);
router.post(
  "/groups/:groupId/messages",
  chatUpload.fields([
    { name: "attachment", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  chatController.sendMessage
);
router.patch("/groups/:groupId/messages/:messageId", chatController.updateMessage);
router.delete("/groups/:groupId/messages/:messageId", chatController.deleteMessage);
router.post("/groups/:groupId/read", chatController.markRead);
router.get("/notifications", chatController.getNotifications);

module.exports = router;
