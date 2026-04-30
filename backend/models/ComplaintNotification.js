const mongoose = require("mongoose");

const complaintNotificationSchema = new mongoose.Schema(
  {
    complaint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    recipientPrincipalType: {
      type: String,
      enum: ["employee", "user"],
      required: true,
      index: true,
    },
    recipientPrincipalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: [
        "pending_department_head",
        "pending_site_head",
        "pending_main_admin",
        "main_admin_reminder",
        "completed_employee",
      ],
      required: true,
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
    collection: "complaint_notifications",
  }
);

complaintNotificationSchema.index({
  recipientPrincipalType: 1,
  recipientPrincipalId: 1,
  readAt: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ComplaintNotification", complaintNotificationSchema);
