const {
  idParamSchema,
  objectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require("./common");

const pollCreateSchema = z
  .object({
    title: requiredTrimmedString("Poll title"),
    description: optionalTrimmedString,
    purpose: optionalTrimmedString,
    startDate: requiredTrimmedString("Start date"),
    endDate: requiredTrimmedString("End date"),
    scopeType: z.preprocess(
      (value) => String(value || "").trim().toLowerCase(),
      z.enum(["company", "site", "department"])
    ),
    scopeIds: z.any(),
    questions: z.any(),
    allowResubmission: z.any().optional(),
    status: optionalTrimmedString,
  })
  .passthrough();

const pollUpdateSchema = pollCreateSchema;

const pollSubmitSchema = z
  .object({
    answers: z.any(),
    remarks: optionalTrimmedString,
  })
  .passthrough();

const pollAssignmentIdParamSchema = z.object({
  assignmentId: objectIdField("Assignment id"),
});

module.exports = {
  idParamSchema,
  pollAssignmentIdParamSchema,
  pollCreateSchema,
  pollSubmitSchema,
  pollUpdateSchema,
};
