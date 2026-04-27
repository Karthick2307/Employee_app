const {
  booleanLike,
  idParamSchema,
  numberLike,
  objectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  timeStringField,
  z,
} = require("./common");

const attendanceRecordCreateSchema = z
  .object({
    employeeId: objectIdField("Employee"),
    attendanceDate: requiredTrimmedString("Attendance date"),
    checkInTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Check in time must be in HH:mm format"
    ),
    checkOutTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Check out time must be in HH:mm format"
    ),
    status: optionalTrimmedString,
    remarks: optionalTrimmedString,
    siteId: objectIdField("Site").optional(),
    departmentId: objectIdField("Department").optional(),
    subDepartmentId: objectIdField("Sub department").optional(),
  })
  .passthrough();

const attendanceRecordUpdateSchema = z
  .object({
    attendanceDate: optionalTrimmedString,
    checkInTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Check in time must be in HH:mm format"
    ),
    checkOutTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Check out time must be in HH:mm format"
    ),
    status: optionalTrimmedString,
    remarks: optionalTrimmedString,
    siteId: objectIdField("Site").optional(),
    departmentId: objectIdField("Department").optional(),
    subDepartmentId: objectIdField("Sub department").optional(),
  })
  .passthrough();

const attendanceSelfActionSchema = z
  .object({
    remarks: optionalTrimmedString,
  })
  .passthrough();

const attendanceSettingsSchema = z
  .object({
    officeStartTime: timeStringField("Office start time"),
    officeEndTime: timeStringField("Office end time"),
    graceMinutes: numberLike("Grace minutes", { min: 0 }),
    minimumFullDayHours: numberLike("Minimum full day hours", { min: 0 }),
    minimumHalfDayHours: numberLike("Minimum half day hours", { min: 0 }),
    missingCheckInStatus: optionalTrimmedString,
    allowSelfCheckIn: booleanLike,
    allowSelfCheckOut: booleanLike,
    allowRegularization: booleanLike,
    futureBiometricEnabled: booleanLike,
    futureQrEnabled: booleanLike,
    futureGpsEnabled: booleanLike,
    lateAlertEnabled: booleanLike,
    missingCheckoutAlertEnabled: booleanLike,
    absenceAlertEnabled: booleanLike,
    reminderAlertEnabled: booleanLike,
  })
  .passthrough();

const regularizationCreateSchema = z
  .object({
    employeeId: objectIdField("Employee").optional(),
    attendanceDate: requiredTrimmedString("Attendance date"),
    requestedCheckInTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Requested check in time must be in HH:mm format"
    ),
    requestedCheckOutTime: optionalTrimmedString.refine(
      (value) => value === undefined || /^(\d{2}):(\d{2})$/.test(value),
      "Requested check out time must be in HH:mm format"
    ),
    requestedStatus: optionalTrimmedString,
    reason: requiredTrimmedString("Reason"),
    requestRemarks: optionalTrimmedString,
  })
  .passthrough();

const regularizationDecisionSchema = z
  .object({
    decisionRemarks: optionalTrimmedString,
  })
  .passthrough();

module.exports = {
  attendanceRecordCreateSchema,
  attendanceRecordUpdateSchema,
  attendanceSelfActionSchema,
  attendanceSettingsSchema,
  idParamSchema,
  regularizationCreateSchema,
  regularizationDecisionSchema,
};
