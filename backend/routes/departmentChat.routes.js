const router = require("express").Router();
const { auth } = require("../middleware/auth");
const chatUpload = require("../middleware/chatUpload");
const departmentChatController = require("../controllers/departmentChat.controller");

router.get("/stream", departmentChatController.stream);

router.use(auth);

router.get("/groups", departmentChatController.listGroups);
router.get("/groups/:groupId/messages", departmentChatController.getMessages);
router.post(
  "/groups/:groupId/messages",
  chatUpload.fields([
    { name: "attachment", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  departmentChatController.sendMessage
);
router.patch(
  "/groups/:groupId/messages/:messageId",
  departmentChatController.updateMessage
);
router.delete(
  "/groups/:groupId/messages/:messageId",
  departmentChatController.deleteMessage
);
router.post("/groups/:groupId/read", departmentChatController.markRead);
router.get("/notifications", departmentChatController.getNotifications);

module.exports = router;
