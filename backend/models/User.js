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
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
