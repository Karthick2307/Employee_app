const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      trim: true
    },

    employeeName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      trim: true
    },

    mobile: {
      type: String,
      trim: true
    },

    /* ✅ DATE OF JOINING (FIX) */
    dateOfJoining: {
      type: Date,
      default: null
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      required: true
    },

    /* ✅ MULTIPLE SITES */
    sites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site"
      }
    ],

    photo: {
      type: String,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Employee", employeeSchema);