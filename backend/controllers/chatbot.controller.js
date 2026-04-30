const ChatbotConversation = require("../models/ChatbotConversation");
const {
  DEFAULT_HISTORY_LIMIT,
  buildQuickActions,
  generateChatbotResponse,
  getRoleLabel,
} = require("../services/chatbot.service");

const normalizeText = (value) => String(value || "").trim();
const normalizeUserId = (user) => normalizeText(user?.id);
const normalizeRole = (user) => normalizeText(user?.role).toLowerCase();

exports.getQuickActions = async (req, res) => {
  try {
    return res.json({
      roleLabel: getRoleLabel(req.user),
      quickActions: buildQuickActions(req.user),
    });
  } catch (err) {
    console.error("GET CHATBOT QUICK ACTIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load chatbot quick actions" });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(30, Math.max(1, Math.floor(requestedLimit)))
      : DEFAULT_HISTORY_LIMIT;

    const rows = await ChatbotConversation.find(
      { userId: normalizeUserId(req.user) },
      "prompt intent responsePayload createdAt"
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      roleLabel: getRoleLabel(req.user),
      quickActions: buildQuickActions(req.user),
      conversations: rows.reverse().map((row) => ({
        _id: row._id,
        prompt: row.prompt,
        intent: row.intent,
        response: row.responsePayload || {},
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET CHATBOT HISTORY ERROR:", err);
    return res.status(500).json({ message: "Failed to load chatbot history" });
  }
};

exports.clearHistory = async (req, res) => {
  try {
    const result = await ChatbotConversation.deleteMany({
      userId: normalizeUserId(req.user),
    });

    return res.json({
      message: result.deletedCount
        ? "Assistant chat history cleared"
        : "No assistant chat history found",
      deletedCount: result.deletedCount || 0,
      roleLabel: getRoleLabel(req.user),
      quickActions: buildQuickActions(req.user),
    });
  } catch (err) {
    console.error("CLEAR CHATBOT HISTORY ERROR:", err);
    return res.status(500).json({ message: "Failed to clear chatbot history" });
  }
};

exports.askChatbot = async (req, res) => {
  try {
    const message = normalizeText(req.body?.message);

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (message.length > 500) {
      return res.status(400).json({ message: "Message is too long" });
    }

    const result = await generateChatbotResponse({
      user: req.user,
      message,
    });
    const conversation = await ChatbotConversation.create({
      userId: normalizeUserId(req.user),
      userRole: normalizeRole(req.user),
      prompt: message,
      intent: result.intent,
      responsePayload: result.response,
    });

    return res.json({
      conversationId: conversation._id,
      roleLabel: getRoleLabel(req.user),
      quickActions: buildQuickActions(req.user),
      intent: result.intent,
      response: result.response,
    });
  } catch (err) {
    console.error("ASK CHATBOT ERROR:", err);
    return res.status(500).json({ message: "Failed to process chatbot request" });
  }
};
