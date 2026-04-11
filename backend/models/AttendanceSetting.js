const mongoose = require("mongoose");

const attendanceSettingSchema = new mongoose.Schema(
  {
    scopeKey: {
      type: String,
      required: true,
      trim: true,
      default: "global",
      unique: true,
    },
    officeStartTime: {
      type: String,
      trim: true,
      default: "09:00",
    },
    officeEndTime: {
      type: String,
      trim: true,
      default: "18:00",
    },
    graceMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    minimumFullDayHours: {
      type: Number,
      default: 8,
      min: 0,
    },
    minimumHalfDayHours: {
      type: Number,
      default: 4,
      min: 0,
    },
    missingCheckInStatus: {
      type: String,
      enum: ["absent", "pending"],
      default: "absent",
    },
    allowSelfCheckIn: {
      type: Boolean,
      default: true,
    },
    allowSelfCheckOut: {
      type: Boolean,
      default: true,
    },
    allowRegularization: {
      type: Boolean,
      default: true,
    },
    futureBiometricEnabled: {
      type: Boolean,
      default: false,
    },
    futureQrEnabled: {
      type: Boolean,
      default: false,
    },
    futureGpsEnabled: {
      type: Boolean,
      default: false,
    },
    lateAlertEnabled: {
      type: Boolean,
      default: false,
    },
    missingCheckoutAlertEnabled: {
      type: Boolean,
      default: false,
    },
    absenceAlertEnabled: {
      type: Boolean,
      default: false,
    },
    reminderAlertEnabled: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AttendanceSetting", attendanceSettingSchema);
