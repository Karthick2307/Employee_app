const mongoose = require("mongoose");

const pollOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: true }
);

const pollQuestionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    responseType: {
      type: String,
      enum: ["single_choice", "multiple_choice"],
      default: "single_choice",
    },
    options: {
      type: [pollOptionSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "Each question must include at least two options",
      },
    },
  },
  { _id: true }
);

const pollMasterSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
    scopeType: {
      type: String,
      enum: ["company", "site", "department"],
      required: true,
      index: true,
    },
    scopeIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
      index: true,
    },
    questions: {
      type: [pollQuestionSchema],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one question is required",
      },
    },
    allowResubmission: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },
    startDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    endDateTime: {
      type: Date,
      required: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "expired", "inactive"],
      default: "upcoming",
      index: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    createdByPrincipalType: {
      type: String,
      enum: ["user", "employee"],
      required: true,
    },
    createdByName: {
      type: String,
      default: "",
      trim: true,
    },
    updatedById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    updatedByPrincipalType: {
      type: String,
      enum: ["user", "employee", ""],
      default: "",
    },
    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "poll_master",
  }
);

pollMasterSchema.index({ scopeType: 1, scopeIds: 1, status: 1, isEnabled: 1 });
pollMasterSchema.index({ startDateTime: 1, endDateTime: 1 });
pollMasterSchema.index({ createdById: 1, createdAt: -1 });

module.exports = mongoose.model("PollMaster", pollMasterSchema);
