const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    dashboardType: {
      type: String,
      enum: ["admin", "employee", "superior", "site", "department", "generic"],
      default: "generic",
    },
    scopeStrategy: {
      type: String,
      enum: ["all", "mapped", "own", "managed"],
      default: "mapped",
    },
    homeModuleKey: {
      type: String,
      default: "dashboard",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
