const {
  idParamSchema,
  objectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  timeStringField,
  z,
} = require("./common");

const checklistCreateSchema = z
  .object({
    checklistName: requiredTrimmedString("Checklist name"),
    assignedToEmployee: objectIdField("Assigned employee"),
    employeeAssignedSite: objectIdField("Assigned site"),
    checklistSourceSite: objectIdField("Checklist source site").optional(),
    scheduleType: z
      .preprocess((value) => String(value || "").trim().toLowerCase(), z.enum([
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "custom",
      ])),
    startDate: requiredTrimmedString("Start date"),
    scheduleTime: timeStringField("Schedule time"),
    endDate: requiredTrimmedString("End date"),
    endTime: timeStringField("End time"),
    priority: optionalTrimmedString,
    isDependentTask: z.any().optional(),
    dependencyChecklistId: optionalTrimmedString,
    checklistItems: z.any().optional(),
    approvals: z.any().optional(),
    approvalHierarchy: optionalTrimmedString,
  })
  .passthrough();

const checklistUpdateSchema = checklistCreateSchema;

const checklistBulkDeleteSchema = z.object({
  checklistIds: z.array(objectIdField("Checklist id")).min(1, "Select at least one checklist"),
});

const checklistDecisionSchema = z
  .object({
    action: optionalTrimmedString,
    decision: optionalTrimmedString,
    remark: optionalTrimmedString,
    comments: optionalTrimmedString,
  })
  .passthrough();

module.exports = {
  checklistBulkDeleteSchema,
  checklistCreateSchema,
  checklistDecisionSchema,
  checklistUpdateSchema,
  idParamSchema,
};
