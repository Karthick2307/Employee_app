const mongoose = require("mongoose");

const SubDepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    headNames: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    }
  },
  { _id: true }
);

SubDepartmentSchema.add({
  children: {
    type: [SubDepartmentSchema],
    default: []
  }
});

const DepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    headNames: {
      type: [
        {
          type: String,
          trim: true
        }
      ],
      default: []
    },
    subDepartments: {
      type: [SubDepartmentSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", DepartmentSchema);
