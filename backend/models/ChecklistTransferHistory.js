const mongoose = require("mongoose");

const checklistTransferHistoryChecklistSchema = new mongoose.Schema(
  {
    checklist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Checklist",
      required: true,
    },
    checklistNumber: {
      type: String,
      required: true,
      trim: true,
    },
    checklistName: {
      type: String,
      required: true,
      trim: true,
    },
    assignedSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
    },
    assignedSiteName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const checklistTransferHistorySchema = new mongoose.Schema(
  {
    transferType: {
      type: String,
      enum: ["permanent", "temporary"],
      default: "permanent",
      index: true,
    },
    transferStatus: {
      type: String,
      enum: ["pending", "active", "completed"],
      default: function resolveTransferStatus() {
        return this.transferType === "temporary" ? "pending" : "completed";
      },
      index: true,
    },
    fromEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    fromEmployeeCode: {
      type: String,
      default: "",
      trim: true,
    },
    fromEmployeeName: {
      type: String,
      default: "",
      trim: true,
    },
    toEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    toEmployeeCode: {
      type: String,
      default: "",
      trim: true,
    },
    toEmployeeName: {
      type: String,
      default: "",
      trim: true,
    },
    checklistNames: {
      type: [String],
      default: [],
    },
    checklists: {
      type: [checklistTransferHistoryChecklistSchema],
      default: [],
    },
    siteIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Site",
      default: [],
      index: true,
    },
    transferStartDate: {
      type: Date,
      default: null,
      index: true,
    },
    transferEndDate: {
      type: Date,
      default: null,
      index: true,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    revertedAt: {
      type: Date,
      default: null,
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    transferredByEmail: {
      type: String,
      default: "",
      trim: true,
    },
    transferredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ChecklistTransferHistory",
  checklistTransferHistorySchema
);
