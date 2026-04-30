const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const chatUpload = require("../middleware/chatUpload");
const departmentChatController = require("../controllers/departmentChat.controller");

router.get(
  "/stream",
  auth,
  requirePermission("department_chat", "view"),
  departmentChatController.stream
);

router.use(auth, requirePermission("department_chat", "view"));

router.get("/groups", departmentChatController.listGroups);
router.get("/groups/:groupId/messages", departmentChatController.getMessages);
router.post(
  "/groups/:groupId/messages",
  requirePermission("department_chat", "add"),
  chatUpload.fields([
    { name: "attachment", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  departmentChatController.sendMessage
);
router.patch(
  "/groups/:groupId/messages/:messageId",
  requirePermission("department_chat", "edit"),
  departmentChatController.updateMessage
);
router.delete(
  "/groups/:groupId/messages/:messageId",
  requirePermission("department_chat", "delete"),
  departmentChatController.deleteMessage
);
router.post("/groups/:groupId/read", departmentChatController.markRead);
router.get("/notifications", departmentChatController.getNotifications);

module.exports = router;
