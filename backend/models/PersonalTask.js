const mongoose = require("mongoose");

const personalTaskSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    assignedEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    attachment: {
      type: String,
      default: null,
      trim: true,
    },
    reminderDate: {
      type: String,
      required: true,
      trim: true,
    },
    reminderTime: {
      type: String,
      required: true,
      trim: true,
    },
    reminderType: {
      type: String,
      enum: ["one_time", "daily", "weekly", "monthly"],
      default: "one_time",
    },
    weeklyDayOfWeek: {
      type: Number,
      default: null,
      min: 0,
      max: 6,
    },
    monthlyDayOfMonth: {
      type: Number,
      default: null,
      min: 1,
      max: 31,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    nextReminderAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    lastNotificationReadAt: {
      type: Date,
      default: null,
    },
    sharedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

personalTaskSchema.index({ employee: 1, status: 1, nextReminderAt: 1 });
personalTaskSchema.index({ assignedEmployee: 1, status: 1, nextReminderAt: 1 });

module.exports = mongoose.model("PersonalTask", personalTaskSchema);
