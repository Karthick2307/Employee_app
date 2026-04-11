const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Site",
    default: null,
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    default: null,
  },
  role: {
    type: String,
    enum: ["admin", "user"],
    default: "user"
  },
  isDefaultAdmin: {
    type: Boolean,
    default: false,
  },
  checklistMasterAccess: {
    type: Boolean,
    default: false,
  },
  accessScopeStrategy: {
    type: String,
    enum: ["inherit", "all", "mapped", "own", "managed"],
    default: "inherit",
  },
  accessCompanyIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Company",
    default: [],
  },
  accessSiteIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Site",
    default: [],
  },
  accessDepartmentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Department",
    default: [],
  },
  accessSubDepartmentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
  },
  accessEmployeeIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Employee",
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
