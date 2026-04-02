const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Bug Report", "Feature Request", "Improvement", "Other"],
      trim: true,
    },
    satisfaction: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    pagePath: {
      type: String,
      default: "",
      trim: true,
    },
    pageTitle: {
      type: String,
      default: "",
      trim: true,
    },
    submittedById: {
      type: String,
      default: "",
      trim: true,
    },
    submittedByRole: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    submittedByName: {
      type: String,
      default: "",
      trim: true,
    },
    adminReadAt: {
      type: Date,
      default: null,
    },
    adminReadById: {
      type: String,
      default: "",
      trim: true,
    },
    adminReadByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ submittedByRole: 1, adminReadAt: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);
