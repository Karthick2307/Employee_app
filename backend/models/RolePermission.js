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

const rolePermissionSchema = new mongoose.Schema(
  {
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
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

rolePermissionSchema.index({ roleId: 1, moduleKey: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
