const mongoose = require("mongoose");

const pollNotificationSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PollMaster",
      required: true,
      index: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PollAssignment",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    notificationType: {
      type: String,
      enum: ["assigned"],
      default: "assigned",
      index: true,
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
  {
    timestamps: true,
    collection: "poll_notifications",
  }
);

pollNotificationSchema.index({ employee: 1, readAt: 1, createdAt: -1 });

module.exports = mongoose.model("PollNotification", pollNotificationSchema);
