const mongoose = require("mongoose");

const checklistRequestNotificationSchema = new mongoose.Schema(
  {
    request: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChecklistAdminRequest",
      required: true,
      index: true,
    },
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientScope: {
      type: String,
      enum: ["admin", "requester"],
      required: true,
      index: true,
    },
    notificationType: {
      type: String,
      enum: ["request_submitted", "request_approved", "request_rejected"],
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    actionType: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    routePath: {
      type: String,
      default: "",
      trim: true,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

checklistRequestNotificationSchema.index({ recipientUser: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model(
  "ChecklistRequestNotification",
  checklistRequestNotificationSchema
);
