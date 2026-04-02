const mongoose = require("mongoose");

const checklistTaskAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const checklistTaskItemSchema = new mongoose.Schema(
  {
    checklistItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
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
    answer: {
      type: String,
      default: "",
      trim: true,
    },
    employeeAnswerRemark: {
      type: String,
      default: "",
      trim: true,
    },
    superiorAnswerRemark: {
      type: String,
      default: "",
      trim: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: true }
);

const checklistTaskApprovalStepSchema = new mongoose.Schema(
  {
    approvalLevel: {
      type: Number,
      required: true,
      min: 1,
    },
    approverEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "pending", "approved", "rejected"],
      default: "waiting",
      index: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    actedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const checklistTaskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    checklist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Checklist",
      required: true,
      index: true,
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
    scheduleType: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly", "custom"],
      required: true,
      index: true,
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
    occurrenceDate: {
      type: Date,
      required: true,
      index: true,
    },
    occurrenceKey: {
      type: String,
      required: true,
      trim: true,
    },
    endDateTime: {
      type: Date,
      default: null,
      index: true,
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
    finalMark: {
      type: Number,
      default: null,
      min: 0,
    },
    approvalType: {
      type: String,
      enum: ["normal", "nil"],
      default: "normal",
      index: true,
    },
    isNilApproval: {
      type: Boolean,
      default: false,
      index: true,
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
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
    dependencyChecklistNumber: {
      type: String,
      default: "",
      trim: true,
    },
    dependencyTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChecklistTask",
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
    dependencyCompletedAt: {
      type: Date,
      default: null,
    },
    dependencyTargetDateTime: {
      type: Date,
      default: null,
      index: true,
    },
    autoCreatedFromDependency: {
      type: Boolean,
      default: false,
      index: true,
    },
    dependencyTriggeredAt: {
      type: Date,
      default: null,
    },
    dependencyStatus: {
      type: String,
      enum: ["not_required", "waiting", "unlocked"],
      default: "not_required",
      index: true,
    },
    unlockedAt: {
      type: Date,
      default: null,
    },
    currentApprovalEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "waiting_dependency",
        "open",
        "submitted",
        "nil_for_approval",
        "approved",
        "nil_approved",
        "rejected",
      ],
      default: "open",
      index: true,
    },
    checklistItems: {
      type: [checklistTaskItemSchema],
      default: [],
    },
    employeeRemarks: {
      type: String,
      default: "",
      trim: true,
    },
    employeeAttachments: {
      type: [checklistTaskAttachmentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    timelinessStatus: {
      type: String,
      enum: ["pending", "advanced", "on_time", "delay"],
      default: "pending",
      index: true,
    },
    submissionTimingStatus: {
      type: String,
      enum: ["pending", "advance", "on_time", "delayed"],
      default: "pending",
      index: true,
    },
    approvalSteps: {
      type: [checklistTaskApprovalStepSchema],
      default: [],
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

checklistTaskSchema.index({ checklist: 1, occurrenceKey: 1 }, { unique: true });
checklistTaskSchema.index({ dependencyTaskId: 1, status: 1 });
checklistTaskSchema.index({ dependencyChecklistId: 1, status: 1 });

module.exports = mongoose.model("ChecklistTask", checklistTaskSchema);
