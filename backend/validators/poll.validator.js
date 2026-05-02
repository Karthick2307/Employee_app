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
<<<<<<< HEAD
    startTime: requiredTrimmedString("Start time"),
    endDate: requiredTrimmedString("End date"),
    endTime: requiredTrimmedString("End time"),
=======
    endDate: requiredTrimmedString("End date"),
>>>>>>> 1431bec5e8ec768e26da0e53c3a9a009d8102dfb
    scopeType: z.preprocess(
      (value) => String(value || "").trim().toLowerCase(),
      z.enum(["company", "site", "department"])
    ),
    scopeIds: z.any(),
    questions: z.any(),
    allowResubmission: z.any().optional(),
<<<<<<< HEAD
    isEnabled: z.any().optional(),
=======
>>>>>>> 1431bec5e8ec768e26da0e53c3a9a009d8102dfb
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
