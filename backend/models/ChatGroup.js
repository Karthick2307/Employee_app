const mongoose = require("mongoose");

const chatReadStateSchema = new mongoose.Schema(
  {
    viewerRole: {
      type: String,
      enum: ["admin", "employee"],
      required: true,
      trim: true,
    },
    viewerId: {
      type: String,
      required: true,
      trim: true,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const chatGroupSchema = new mongoose.Schema(
  {
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
    // Mirror the active scope id into the legacy unique field so existing
    // deployments keep the one-group-per-scope constraint without index churn.
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    groupName: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    memberEmployeeIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
      ],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      default: "",
      trim: true,
    },
    readStates: {
      type: [chatReadStateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatGroup", chatGroupSchema);
