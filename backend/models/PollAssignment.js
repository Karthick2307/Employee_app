const mongoose = require("mongoose");

const pollAssignmentSchema = new mongoose.Schema(
  {
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PollMaster",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["not_answered", "submitted", "revoked"],
      default: "not_answered",
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    response: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PollResponse",
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "poll_assignments",
  }
);

pollAssignmentSchema.index({ poll: 1, employee: 1 }, { unique: true });
pollAssignmentSchema.index({ employee: 1, status: 1, assignedAt: -1 });

module.exports = mongoose.model("PollAssignment", pollAssignmentSchema);
