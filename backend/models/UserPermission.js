const mongoose = require("mongoose");

const permissionFieldSchema = {
  canView: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canApprove: { type: Boolean, default: false },
  canReject: { type: Boolean, default: false },
  canStatusUpdate: { type: Boolean, default: false },
  canTransfer: { type: Boolean, default: false },
  canExport: { type: Boolean, default: false },
  canReportView: { type: Boolean, default: false },
};

const userPermissionSchema = new mongoose.Schema(
  {
    principalType: {
      type: String,
      required: true,
      enum: ["user", "employee"],
      index: true,
    },
    principalId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    ...permissionFieldSchema,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

userPermissionSchema.index(
  { principalType: 1, principalId: 1, moduleKey: 1 },
  { unique: true }
);

module.exports = mongoose.model("UserPermission", userPermissionSchema);
