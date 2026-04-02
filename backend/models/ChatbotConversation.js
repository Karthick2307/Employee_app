const mongoose = require("mongoose");

const chatbotConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userRole: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    intent: {
      type: String,
      default: "help",
      trim: true,
    },
    responsePayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

chatbotConversationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatbotConversation", chatbotConversationSchema);
