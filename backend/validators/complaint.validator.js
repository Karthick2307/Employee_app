const {
  idParamSchema,
  objectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require("./common");

const complaintCreateSchema = z
  .object({
    departmentId: objectIdField("Department").optional(),
    department: objectIdField("Department").optional(),
    complaintText: optionalTrimmedString,
    complaintBox: optionalTrimmedString,
  })
  .superRefine((value, context) => {
    if (!value.departmentId && !value.department) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a valid department",
        path: ["departmentId"],
      });
    }

    if (!value.complaintText && !value.complaintBox) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Complaint details are required",
        path: ["complaintText"],
      });
    }
  })
  .passthrough();

const complaintActionSchema = z
  .object({
    action: z.preprocess(
      (value) => String(value || "").trim().toLowerCase(),
      z.enum(["submit", "forward", "complete"])
    ),
    remark: optionalTrimmedString,
  })
  .passthrough();

module.exports = {
  complaintActionSchema,
  complaintCreateSchema,
  idParamSchema,
};
