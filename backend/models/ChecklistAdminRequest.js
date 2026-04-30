const mongoose = require("mongoose");

const { Mixed } = mongoose.Schema.Types;

const checklistAdminRequestSchema = new mongoose.Schema(
  {
    moduleKey: {
      type: String,
      enum: ["checklist_master", "checklist_transfer"],
      required: true,
      index: true,
    },
    moduleName: {
      type: String,
      default: "",
      trim: true,
    },
    actionType: {
      type: String,
      enum: ["add", "edit", "permanent_transfer", "temporary_transfer"],
      required: true,
      index: true,
    },
    entryId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    entryLabel: {
      type: String,
      default: "",
      trim: true,
    },
    requestSummary: {
      type: String,
      default: "",
      trim: true,
    },
    targetChecklist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Checklist",
      default: null,
      index: true,
    },
    relatedChecklistIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Checklist",
      default: [],
      index: true,
    },
    moduleSiteIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Site",
      default: [],
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedByName: {
      type: String,
      default: "",
      trim: true,
    },
    requestedByEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ["pending_admin_approval", "approved", "rejected"],
      default: "pending_admin_approval",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedByName: {
      type: String,
      default: "",
      trim: true,
    },
    reviewedByEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    requestPayload: {
      type: Mixed,
      default: {},
    },
    oldPayload: {
      type: Mixed,
      default: {},
    },
    oldDisplay: {
      type: Mixed,
      default: {},
    },
    newDisplay: {
      type: Mixed,
      default: {},
    },
    comparisonRows: {
      type: [Mixed],
      default: [],
    },
    resultEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resultEntryModel: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

checklistAdminRequestSchema.index({ status: 1, createdAt: -1 });
checklistAdminRequestSchema.index({ requestedBy: 1, createdAt: -1 });
checklistAdminRequestSchema.index({ targetChecklist: 1, status: 1 });

module.exports = mongoose.model("ChecklistAdminRequest", checklistAdminRequestSchema);
