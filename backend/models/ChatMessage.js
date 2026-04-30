const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatGroup",
      required: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ["site", "department"],
      default: "site",
      index: true,
    },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
      trim: true,
    },
    senderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
      maxlength: 4000,
    },
    attachmentFileName: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentOriginalName: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentMimeType: {
      type: String,
      default: "",
      trim: true,
    },
    attachmentSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    imageFileName: {
      type: String,
      default: "",
      trim: true,
    },
    imageOriginalName: {
      type: String,
      default: "",
      trim: true,
    },
    imageMimeType: {
      type: String,
      default: "",
      trim: true,
    },
    mentions: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      default: [],
    },
    mentionNames: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    searchText: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
