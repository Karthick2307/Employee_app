const mongoose = require("mongoose");

const complaintAttachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      default: "",
      trim: true,
    },
    originalName: {
      type: String,
      default: "",
      trim: true,
    },
    mimetype: {
      type: String,
      default: "",
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    url: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const complaintRemarkSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["submit", "forward", "complete"],
      default: null,
    },
    remark: {
      type: String,
      default: "",
      trim: true,
    },
    actedByPrincipalType: {
      type: String,
      enum: ["employee", "user"],
      default: "employee",
    },
    actedByPrincipalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actedByName: {
      type: String,
      default: "",
      trim: true,
    },
    actedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const complaintTimelineSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      enum: ["employee", "department_head", "site_head", "main_admin", "completed"],
      required: true,
    },
    action: {
      type: String,
      enum: ["created", "submit", "forward", "complete"],
      required: true,
    },
    remark: {
      type: String,
      default: "",
      trim: true,
    },
    actedByPrincipalType: {
      type: String,
      enum: ["employee", "user"],
      default: "employee",
    },
    actedByPrincipalId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    actedByName: {
      type: String,
      default: "",
      trim: true,
    },
    actedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      default: "",
      trim: true,
    },
    employeeCode: {
      type: String,
      default: "",
      trim: true,
    },
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },
    siteName: {
      type: String,
      default: "",
      trim: true,
    },
    siteCompanyName: {
      type: String,
      default: "",
      trim: true,
    },
    siteDisplayName: {
      type: String,
      default: "",
      trim: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    departmentName: {
      type: String,
      default: "",
      trim: true,
    },
    complaintText: {
      type: String,
      required: true,
      trim: true,
    },
    attachment: {
      type: complaintAttachmentSchema,
      default: null,
    },
    currentLevel: {
      type: String,
      enum: ["department_head", "site_head", "main_admin", "completed"],
      default: "department_head",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "pending_department_head",
        "pending_site_head",
        "pending_main_admin",
        "completed",
      ],
      default: "pending_department_head",
      index: true,
    },
    routing: {
      departmentHeadPrincipalType: {
        type: String,
        enum: ["employee", "user"],
        default: "employee",
      },
      departmentHeadPrincipalId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      departmentHeadName: {
        type: String,
        default: "",
        trim: true,
      },
      siteHeadPrincipalType: {
        type: String,
        enum: ["employee", "user"],
        default: "employee",
      },
      siteHeadPrincipalId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
      siteHeadName: {
        type: String,
        default: "",
        trim: true,
      },
      mainAdminPrincipalIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: [],
      },
      mainAdminNames: {
        type: [
          {
            type: String,
            trim: true,
          },
        ],
        default: [],
      },
    },
    remarks: {
      departmentHead: {
        type: complaintRemarkSchema,
        default: null,
      },
      siteHead: {
        type: complaintRemarkSchema,
        default: null,
      },
      mainAdmin: {
        type: complaintRemarkSchema,
        default: null,
      },
    },
    timeline: {
      type: [complaintTimelineSchema],
      default: [],
    },
    raisedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deadlineAt: {
      type: Date,
      default: null,
      index: true,
    },
    isOverdue: {
      type: Boolean,
      default: false,
      index: true,
    },
    reminderLastSentAt: {
      type: Date,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastMovedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "complaints",
  }
);

complaintSchema.index({ employee: 1, createdAt: -1 });
complaintSchema.index({ "routing.departmentHeadPrincipalId": 1, createdAt: -1 });
complaintSchema.index({ "routing.siteHeadPrincipalId": 1, createdAt: -1 });
complaintSchema.index({ "routing.mainAdminPrincipalIds": 1, createdAt: -1 });
complaintSchema.index({ status: 1, deadlineAt: 1 });
complaintSchema.index({ isOverdue: 1, deadlineAt: 1 });

module.exports = mongoose.model("Complaint", complaintSchema);
