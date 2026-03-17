const mongoose = require("mongoose");

const employeeSubSiteSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true
    },
    subSite: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  { _id: false }
);

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

    password: {
      type: String,
      default: "",
      select: false
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
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Department"
        }
      ],
      default: []
    },

    subDepartment: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      required: true
    },

    superiorEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },

    /* ✅ MULTIPLE SITES */
    sites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site"
      }
    ],

    subSites: {
      type: [employeeSubSiteSchema],
      default: []
    },

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

