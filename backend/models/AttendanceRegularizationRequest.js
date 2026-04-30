const mongoose = require("mongoose");

const actorSchema = new mongoose.Schema(
  {
    principalType: {
      type: String,
      enum: ["user", "employee"],
      required: true,
    },
    principalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const attendanceRegularizationRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeCode: {
      type: String,
      trim: true,
      default: "",
    },
    employeeName: {
      type: String,
      trim: true,
      default: "",
    },
    attendanceDate: {
      type: Date,
      required: true,
      index: true,
    },
    attendanceDateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    currentRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendanceRecord",
      default: null,
    },
    currentStatus: {
      type: String,
      trim: true,
      default: "",
    },
    requestedCheckInTime: {
      type: Date,
      default: null,
    },
    requestedCheckOutTime: {
      type: Date,
      default: null,
    },
    requestedStatus: {
      type: String,
      enum: [
        "present",
        "absent",
        "half_day",
        "leave",
        "week_off",
        "holiday",
        "late",
        "on_duty",
        "pending",
      ],
      default: "pending",
    },
    reason: {
      type: String,
      trim: true,
      required: true,
    },
    requestRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    decisionRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    requestedBy: {
      type: actorSchema,
      required: true,
    },
    decidedBy: {
      type: actorSchema,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AttendanceRegularizationRequest",
  attendanceRegularizationRequestSchema
);
