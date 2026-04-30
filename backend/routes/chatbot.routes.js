const router = require("express").Router();
const { auth } = require("../middleware/auth");
const {
  askChatbot,
  clearHistory,
  getHistory,
  getQuickActions,
} = require("../controllers/chatbot.controller");

router.get("/quick-actions", auth, getQuickActions);
router.get("/history", auth, getHistory);
router.delete("/history", auth, clearHistory);
router.post("/query", auth, askChatbot);

module.exports = router;
