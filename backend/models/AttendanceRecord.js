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

const attendanceRecordSchema = new mongoose.Schema(
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
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    totalWorkingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
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
      index: true,
    },
    lateMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      default: null,
      index: true,
    },
    siteName: {
      type: String,
      trim: true,
      default: "",
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    departmentName: {
      type: String,
      trim: true,
      default: "",
    },
    subDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    subDepartmentName: {
      type: String,
      trim: true,
      default: "",
    },
    reportingHeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    reportingHeadName: {
      type: String,
      trim: true,
      default: "",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    entryMethod: {
      type: String,
      enum: ["manual", "self", "regularization", "biometric", "qr", "gps"],
      default: "manual",
    },
    missingCheckOut: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: actorSchema,
      default: null,
    },
    updatedBy: {
      type: actorSchema,
      default: null,
    },
  },
  { timestamps: true }
);

attendanceRecordSchema.index(
  { employeeId: 1, attendanceDateKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema);
