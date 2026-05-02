const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    detail: {
      type: String,
      default: "",
      trim: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const checklistApprovalSchema = new mongoose.Schema(
  {
    approvalLevel: {
      type: Number,
      required: true,
      min: 1,
    },
    approvalEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { _id: false }
);

const checklistSchema = new mongoose.Schema(
  {
    checklistNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    checklistName: {
      type: String,
      required: true,
      trim: true,
    },
    checklistMark: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    enableMark: {
      type: Boolean,
      default: false,
    },
    baseMark: {
      type: Number,
      default: null,
      min: 0,
    },
    delayPenaltyPerDay: {
      type: Number,
      default: null,
      min: 0,
    },
    advanceBonusPerDay: {
      type: Number,
      default: null,
      min: 0,
    },
    checklistSourceSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    assignedToEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeAssignedSite: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    scheduleType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    scheduleTime: {
      type: String,
      required: true,
      trim: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    endTime: {
      type: String,
      default: "",
      trim: true,
    },
    customRepeatInterval: {
      type: Number,
      default: 1,
      min: 1,
    },
    customRepeatUnit: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      default: "daily",
    },
    repeatDayOfMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 31,
    },
    repeatDayOfWeek: {
      type: String,
      default: "",
      trim: true,
    },
    repeatMonthOfYear: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    repeatSummary: {
      type: String,
      default: "",
      trim: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
      index: true,
    },
    isDependentTask: {
      type: Boolean,
      default: false,
      index: true,
    },
    dependencyChecklistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Checklist",
      default: null,
      index: true,
    },
    dependencyTaskNumber: {
      type: String,
      default: "",
      trim: true,
    },
    targetDayCount: {
      type: Number,
      default: null,
      min: 0.01,
    },
    checklistItems: {
      type: [checklistItemSchema],
      default: [],
    },
    approvalHierarchy: {
      type: String,
      enum: ["default", "custom"],
      default: "default",
    },
    approvals: {
      type: [checklistApprovalSchema],
      default: [],
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
    nextOccurrenceAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: function defaultChecklistIsActive() {
        return this.status !== false;
      },
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const excludeSoftDeletedChecklists = function excludeSoftDeletedChecklists() {
  this.where({ isDeleted: { $ne: true } });
};

checklistSchema.pre("countDocuments", excludeSoftDeletedChecklists);
checklistSchema.pre(/^find/, excludeSoftDeletedChecklists);

module.exports = mongoose.model("Checklist", checklistSchema);
