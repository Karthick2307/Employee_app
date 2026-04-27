const mongoose = require("mongoose");

const pollResponseAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    selectedOptionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
  },
  { _id: false }
);

const pollResponseAttachmentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      default: "",
      trim: true,
    },
    originalName: {
      type: String,
      default: "",
      trim: true,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const pollResponseSchema = new mongoose.Schema(
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
    answers: {
      type: [pollResponseAnswerSchema],
      default: [],
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
    attachments: {
      type: [pollResponseAttachmentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "poll_responses",
  }
);

pollResponseSchema.index({ assignment: 1 }, { unique: true });
pollResponseSchema.index({ poll: 1, employee: 1, submittedAt: -1 });

module.exports = mongoose.model("PollResponse", pollResponseSchema);
