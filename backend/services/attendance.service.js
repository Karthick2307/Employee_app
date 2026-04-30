const Company = require("../models/Company");
const Employee = require("../models/Employee");
const AttendanceSetting = require("../models/AttendanceSetting");
const { buildEmployeeScopeFilter, uniqueIdList } = require("./accessScope.service");

const STATUS_LABELS = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "Leave",
  week_off: "Week Off",
  holiday: "Holiday",
  late: "Late",
  on_duty: "On Duty / Field Work",
  pending: "Pending",
};

const REGULARIZATION_STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const DEFAULT_ATTENDANCE_SETTINGS = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  graceMinutes: 15,
  minimumFullDayHours: 8,
  minimumHalfDayHours: 4,
  missingCheckInStatus: "absent",
  allowSelfCheckIn: true,
  allowSelfCheckOut: true,
  allowRegularization: true,
  futureBiometricEnabled: false,
  futureQrEnabled: false,
  futureGpsEnabled: false,
  lateAlertEnabled: false,
  missingCheckoutAlertEnabled: false,
  absenceAlertEnabled: false,
  reminderAlertEnabled: false,
};

const TIMED_STATUS_KEYS = new Set(["present", "half_day", "late", "pending"]);
const SPECIAL_STATUS_KEYS = new Set(["absent", "leave", "week_off", "holiday", "on_duty"]);

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
const normalizeStatusKey = (value) => normalizeText(value).toLowerCase();

const formatEmployeeDisplayName = (employee) => {
  const code = normalizeText(employee?.employeeCode);
  const name = normalizeText(employee?.employeeName);

  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const formatSiteDisplayName = (site) => {
  const companyName = normalizeText(site?.companyName);
  const siteName = normalizeText(site?.name);

  if (companyName && siteName) return `${companyName} - ${siteName}`;
  return siteName || companyName;
};

const toLocalDate = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const rawValue = normalizeText(value);
  if (!rawValue) return null;

  const plainDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);
  if (plainDateMatch) {
    const [, year, month, day] = plainDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const startOfDay = (value) => {
  const date = toLocalDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

const endOfDay = (value) => {
  const date = toLocalDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

const getDateKey = (value) => {
  const date = toLocalDate(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseTimeParts = (value) => {
  const rawValue = normalizeText(value);
  if (!rawValue) return null;

  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(rawValue);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = Number(timeMatch[3] || 0);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  return { hours, minutes, seconds };
};

const buildDateTime = (dateValue, timeValue) => {
  if (!timeValue) return null;
  if (timeValue instanceof Date && !Number.isNaN(timeValue.getTime())) {
    return new Date(timeValue.getTime());
  }

  const attendanceDate = startOfDay(dateValue);
  const timeParts = parseTimeParts(timeValue);
  if (!attendanceDate || !timeParts) return null;

  return new Date(
    attendanceDate.getFullYear(),
    attendanceDate.getMonth(),
    attendanceDate.getDate(),
    timeParts.hours,
    timeParts.minutes,
    timeParts.seconds,
    0
  );
};

const formatTimeLabel = (value) => {
  const date = toLocalDate(value);
  if (!date) return "-";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDateLabel = (value) => {
  const date = toLocalDate(value);
  if (!date) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDurationMinutes = (minutesValue) => {
  const minutes = Number(minutesValue || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h 0m";

  const hoursPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return `${hoursPart}h ${minutePart}m`;
};

const getMinutesFromTimeString = (value) => {
  const timeParts = parseTimeParts(value);
  if (!timeParts) return 0;
  return timeParts.hours * 60 + timeParts.minutes;
};

const getWorkingMinutes = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return 0;

  const startTime = toLocalDate(checkInTime);
  const endTime = toLocalDate(checkOutTime);
  if (!startTime || !endTime) return 0;

  const difference = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
  return difference > 0 ? difference : 0;
};

const getLateMinutes = (checkInTime, settings) => {
  if (!checkInTime) return 0;

  const startTime = toLocalDate(checkInTime);
  if (!startTime) return 0;

  const shiftStartMinutes =
    getMinutesFromTimeString(settings.officeStartTime) + Number(settings.graceMinutes || 0);
  const actualMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  return Math.max(0, actualMinutes - shiftStartMinutes);
};

const buildActor = (sessionUser = {}) => ({
  principalType: sessionUser?.principalType === "employee" ? "employee" : "user",
  principalId: sessionUser?.id,
  displayName: normalizeText(sessionUser?.name || sessionUser?.email || sessionUser?.employeeCode),
});

const ensureAttendanceSettings = async () => {
  let settings = await AttendanceSetting.findOne({ scopeKey: "global" });

  if (!settings) {
    settings = await AttendanceSetting.create({
      scopeKey: "global",
      ...DEFAULT_ATTENDANCE_SETTINGS,
    });
  }

  return settings;
};

const getAttendanceSettings = async () => {
  const settings = await ensureAttendanceSettings();
  return {
    ...DEFAULT_ATTENDANCE_SETTINGS,
    ...(settings.toObject ? settings.toObject() : settings),
  };
};

const getStatusLabel = (statusKey) => STATUS_LABELS[normalizeStatusKey(statusKey)] || "Unknown";
const getRegularizationStatusLabel = (statusKey) =>
  REGULARIZATION_STATUS_LABELS[normalizeStatusKey(statusKey)] || "Unknown";

const isLateStatusMatch = (row) => Number(row?.lateMinutes || 0) > 0 || normalizeStatusKey(row?.status) === "late";

const resolveAttendanceStatus = ({
  requestedStatus,
  checkInTime,
  checkOutTime,
  totalWorkingMinutes,
  lateMinutes,
  settings,
}) => {
  const normalizedStatus = normalizeStatusKey(requestedStatus);

  if (SPECIAL_STATUS_KEYS.has(normalizedStatus)) {
    return normalizedStatus;
  }

  if (!checkInTime && !checkOutTime) {
    if (TIMED_STATUS_KEYS.has(normalizedStatus)) {
      return normalizedStatus;
    }

    return normalizeStatusKey(settings.missingCheckInStatus) || "absent";
  }

  const minimumFullDayMinutes = Math.max(0, Number(settings.minimumFullDayHours || 0) * 60);
  const minimumHalfDayMinutes = Math.max(0, Number(settings.minimumHalfDayHours || 0) * 60);

  if (totalWorkingMinutes > 0 && totalWorkingMinutes < minimumFullDayMinutes) {
    if (totalWorkingMinutes >= minimumHalfDayMinutes) {
      return "half_day";
    }

    return normalizedStatus === "late" ? "late" : "half_day";
  }

  if (lateMinutes > 0) {
    return "late";
  }

  if (normalizedStatus === "half_day") {
    return "half_day";
  }

  return "present";
};

const findNestedNodeById = (rows = [], targetId) => {
  for (const row of rows) {
    if (normalizeId(row?._id) === normalizeId(targetId)) {
      return row;
    }

    const child = findNestedNodeById(row.children || [], targetId);
    if (child) return child;
  }

  return null;
};

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((row) => {
    const nextTrail = [...trail, normalizeText(row?.name)];

    return [
      {
        _id: normalizeId(row?._id),
        name: normalizeText(row?.name),
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
        departmentId: normalizeId(department?._id),
      },
      ...flattenSubDepartments(row.children || [], nextTrail, department),
    ];
  });

const resolveCompanyByName = async (companyName) => {
  const normalizedName = normalizeText(companyName);
  if (!normalizedName) return null;
  return Company.findOne({ name: normalizedName }, "_id name").lean();
};

const buildAttendanceEmployeeFilter = async (access = {}, filters = {}, options = {}) => {
  const baseFilter = { ...(await buildEmployeeScopeFilter(access)) };

  if (baseFilter._id === null) {
    return baseFilter;
  }

  if (!options.includeInactive) {
    baseFilter.isActive = { $ne: false };
  }

  const employeeId = normalizeText(filters.employeeId || filters.assignedEmployee);
  const siteId = normalizeText(filters.siteId);
  const departmentId = normalizeText(filters.departmentId || filters.department);
  const subDepartmentId = normalizeText(filters.subDepartmentId || filters.subDepartment);

  if (employeeId) {
    if (baseFilter._id?.$in) {
      if (!baseFilter._id.$in.map(String).includes(employeeId)) {
        return { _id: null };
      }
    }

    baseFilter._id = employeeId;
  }

  if (siteId) {
    baseFilter.sites = siteId;
  }

  if (departmentId) {
    baseFilter.department = departmentId;
  }

  if (subDepartmentId) {
    baseFilter.subDepartment = subDepartmentId;
  }

  return baseFilter;
};

const getAttendanceEmployees = async (access = {}, filters = {}, options = {}) => {
  const employeeFilter = await buildAttendanceEmployeeFilter(access, filters, options);
  if (employeeFilter._id === null) {
    return [];
  }

  const employees = await Employee.find(employeeFilter)
    .populate("department", "name subDepartments")
    .populate("sites", "name companyName")
    .populate("superiorEmployee", "employeeCode employeeName")
    .sort({ employeeName: 1 })
    .lean();

  const companyNameFilter = normalizeText(filters.companyName);
  const companyIdFilter = normalizeText(filters.companyId);
  let allowedCompanyNames = null;

  if (companyIdFilter) {
    const company = await Company.findById(companyIdFilter, "name").lean();
    allowedCompanyNames = company?.name ? new Set([company.name]) : new Set();
  } else if (companyNameFilter) {
    allowedCompanyNames = new Set([companyNameFilter]);
  }

  if (!allowedCompanyNames) {
    return employees;
  }

  return employees.filter((employee) =>
    (employee.sites || []).some((site) => allowedCompanyNames.has(normalizeText(site?.companyName)))
  );
};

const resolveAttendanceContextForEmployee = async (employee = {}, selection = {}) => {
  const selectedSiteId = normalizeText(selection.siteId);
  const selectedDepartmentId = normalizeText(selection.departmentId);
  const selectedSubDepartmentId = normalizeText(selection.subDepartmentId);

  const selectedSite =
    (employee.sites || []).find((site) => normalizeId(site?._id) === selectedSiteId) ||
    (employee.sites || [])[0] ||
    null;
  const selectedDepartment =
    (employee.department || []).find(
      (department) => normalizeId(department?._id) === selectedDepartmentId
    ) ||
    (employee.department || [])[0] ||
    null;
  const flattenedSubDepartments = (employee.department || []).flatMap((department) =>
    flattenSubDepartments(department.subDepartments || [], [], department)
  );
  const selectedSubDepartment =
    flattenedSubDepartments.find(
      (subDepartment) => normalizeId(subDepartment?._id) === selectedSubDepartmentId
    ) ||
    flattenedSubDepartments.find(
      (subDepartment) => normalizeId(subDepartment?.departmentId) === normalizeId(selectedDepartment?._id)
    ) ||
    flattenedSubDepartments[0] ||
    null;
  const companyName = normalizeText(selectedSite?.companyName);
  const company = await resolveCompanyByName(companyName);

  return {
    employeeId: employee?._id,
    employeeCode: normalizeText(employee?.employeeCode),
    employeeName: normalizeText(employee?.employeeName),
    companyId: company?._id || null,
    companyName,
    siteId: selectedSite?._id || null,
    siteName: normalizeText(selectedSite?.name),
    departmentId: selectedDepartment?._id || null,
    departmentName: normalizeText(selectedDepartment?.name),
    subDepartmentId: selectedSubDepartment?._id || null,
    subDepartmentName: normalizeText(selectedSubDepartment?.name),
    reportingHeadId: employee?.superiorEmployee?._id || null,
    reportingHeadName: formatEmployeeDisplayName(employee?.superiorEmployee),
  };
};

const prepareAttendanceRecordPayload = async ({
  employee,
  existingRecord = null,
  input = {},
  settings = DEFAULT_ATTENDANCE_SETTINGS,
  actor,
  entryMethod = "manual",
}) => {
  const explicitAttendanceDate =
    startOfDay(input.attendanceDate) ||
    startOfDay(existingRecord?.attendanceDate) ||
    startOfDay(input.checkInTime) ||
    startOfDay(input.checkOutTime) ||
    startOfDay(new Date());

  if (!explicitAttendanceDate) {
    const error = new Error("Attendance date is required");
    error.status = 400;
    throw error;
  }

  const attendanceDateKey = getDateKey(explicitAttendanceDate);
  const checkInTime =
    input.checkInTime === "" || input.checkInTime === null
      ? null
      : buildDateTime(explicitAttendanceDate, input.checkInTime) ||
        toLocalDate(input.checkInTime) ||
        existingRecord?.checkInTime ||
        null;
  const checkOutTime =
    input.checkOutTime === "" || input.checkOutTime === null
      ? null
      : buildDateTime(explicitAttendanceDate, input.checkOutTime) ||
        toLocalDate(input.checkOutTime) ||
        existingRecord?.checkOutTime ||
        null;

  if (checkInTime && checkOutTime && checkOutTime.getTime() < checkInTime.getTime()) {
    const error = new Error("Check-out time cannot be earlier than check-in time");
    error.status = 400;
    throw error;
  }

  const resolvedContext = await resolveAttendanceContextForEmployee(employee, input);
  const totalWorkingMinutes = getWorkingMinutes(checkInTime, checkOutTime);
  const lateMinutes = getLateMinutes(checkInTime, settings);
  const requestedStatus = normalizeStatusKey(input.status || existingRecord?.status);
  const status = resolveAttendanceStatus({
    requestedStatus,
    checkInTime,
    checkOutTime,
    totalWorkingMinutes,
    lateMinutes,
    settings,
  });

  return {
    ...resolvedContext,
    attendanceDate: explicitAttendanceDate,
    attendanceDateKey,
    checkInTime,
    checkOutTime,
    totalWorkingMinutes,
    status,
    lateMinutes,
    remarks: normalizeText(input.remarks || existingRecord?.remarks),
    entryMethod: normalizeStatusKey(input.entryMethod) || entryMethod,
    missingCheckOut: Boolean(checkInTime && !checkOutTime),
    createdBy: existingRecord?.createdBy || actor,
    updatedBy: actor,
  };
};

const buildSyntheticAttendanceRow = ({
  employee,
  attendanceDate,
  settings = DEFAULT_ATTENDANCE_SETTINGS,
}) => {
  const selectedSite = (employee.sites || [])[0] || null;
  const selectedDepartment = (employee.department || [])[0] || null;
  const flattenedSubDepartments = (employee.department || []).flatMap((department) =>
    flattenSubDepartments(department.subDepartments || [], [], department)
  );
  const selectedSubDepartment = flattenedSubDepartments[0] || null;
  const status = normalizeStatusKey(settings.missingCheckInStatus) || "absent";

  return {
    _id: `synthetic:${normalizeId(employee?._id)}:${getDateKey(attendanceDate)}`,
    isSynthetic: true,
    employeeId: employee?._id,
    employeeCode: normalizeText(employee?.employeeCode),
    employeeName: normalizeText(employee?.employeeName),
    attendanceDate: startOfDay(attendanceDate),
    attendanceDateKey: getDateKey(attendanceDate),
    checkInTime: null,
    checkOutTime: null,
    totalWorkingMinutes: 0,
    totalWorkingHoursLabel: "0h 0m",
    status,
    statusLabel: getStatusLabel(status),
    lateMinutes: 0,
    companyId: null,
    companyName: normalizeText(selectedSite?.companyName),
    siteId: selectedSite?._id || null,
    siteName: normalizeText(selectedSite?.name),
    siteDisplayName: formatSiteDisplayName(selectedSite),
    departmentId: selectedDepartment?._id || null,
    departmentName: normalizeText(selectedDepartment?.name),
    subDepartmentId: selectedSubDepartment?._id || null,
    subDepartmentName: normalizeText(selectedSubDepartment?.name),
    reportingHeadId: employee?.superiorEmployee?._id || null,
    reportingHeadName: formatEmployeeDisplayName(employee?.superiorEmployee),
    remarks: "",
    entryMethod: "manual",
    missingCheckOut: false,
    checkInLabel: "-",
    checkOutLabel: "-",
    attendanceDateLabel: formatDateLabel(attendanceDate),
    employeeDisplayName: formatEmployeeDisplayName(employee),
  };
};

const mapAttendanceRecord = (record = {}) => {
  const normalizedRecord = record.toObject ? record.toObject() : record;
  const employeeDisplayName = normalizedRecord.employeeCode && normalizedRecord.employeeName
    ? `${normalizedRecord.employeeCode} - ${normalizedRecord.employeeName}`
    : normalizedRecord.employeeName || normalizedRecord.employeeCode || "";
  const siteDisplayName =
    normalizedRecord.companyName && normalizedRecord.siteName
      ? `${normalizedRecord.companyName} - ${normalizedRecord.siteName}`
      : normalizedRecord.siteName || normalizedRecord.companyName || "";

  return {
    ...normalizedRecord,
    employeeDisplayName,
    siteDisplayName,
    attendanceDateLabel: formatDateLabel(normalizedRecord.attendanceDate),
    checkInLabel: formatTimeLabel(normalizedRecord.checkInTime),
    checkOutLabel: formatTimeLabel(normalizedRecord.checkOutTime),
    totalWorkingHoursLabel: formatDurationMinutes(normalizedRecord.totalWorkingMinutes),
    statusLabel: getStatusLabel(normalizedRecord.status),
    isLate: isLateStatusMatch(normalizedRecord),
  };
};

const mergeDailyAttendanceRows = ({
  employees = [],
  records = [],
  attendanceDate,
  settings = DEFAULT_ATTENDANCE_SETTINGS,
  statusFilter = "",
}) => {
  const recordMap = new Map(
    records.map((record) => [normalizeId(record.employeeId), mapAttendanceRecord(record)])
  );

  const rows = employees.map((employee) => {
    const existingRecord = recordMap.get(normalizeId(employee?._id));
    return existingRecord || buildSyntheticAttendanceRow({ employee, attendanceDate, settings });
  });

  if (!normalizeText(statusFilter)) {
    return rows;
  }

  const normalizedFilter = normalizeStatusKey(statusFilter);
  return rows.filter((row) => {
    if (normalizedFilter === "late") {
      return isLateStatusMatch(row);
    }

    return normalizeStatusKey(row.status) === normalizedFilter;
  });
};

const getDateRangeFromQuery = (query = {}, options = {}) => {
  const singleDate = startOfDay(query.date);
  if (singleDate) {
    return {
      fromDate: singleDate,
      toDate: endOfDay(singleDate),
      singleDate,
      dateKey: getDateKey(singleDate),
    };
  }

  const parsedFromDate = startOfDay(query.fromDate);
  const parsedToDate = endOfDay(query.toDate);

  if (parsedFromDate && parsedToDate) {
    return {
      fromDate: parsedFromDate,
      toDate: parsedToDate,
      singleDate:
        getDateKey(parsedFromDate) === getDateKey(parsedToDate) ? startOfDay(parsedFromDate) : null,
      dateKey:
        getDateKey(parsedFromDate) === getDateKey(parsedToDate) ? getDateKey(parsedFromDate) : "",
    };
  }

  if (options.defaultToToday !== false) {
    const today = startOfDay(new Date());
    return {
      fromDate: today,
      toDate: endOfDay(today),
      singleDate: today,
      dateKey: getDateKey(today),
    };
  }

  return {
    fromDate: null,
    toDate: null,
    singleDate: null,
    dateKey: "",
  };
};

const buildRecordFilter = ({ employeeIds = [], fromDate = null, toDate = null, filters = {} }) => {
  const filter = {};

  if (Array.isArray(employeeIds) && !employeeIds.length) {
    return { employeeId: null };
  }

  if (employeeIds.length) {
    filter.employeeId = { $in: employeeIds };
  }

  if (fromDate || toDate) {
    filter.attendanceDate = {};
    if (fromDate) filter.attendanceDate.$gte = fromDate;
    if (toDate) filter.attendanceDate.$lte = toDate;
  }

  const statusFilter = normalizeStatusKey(filters.status);
  if (statusFilter && statusFilter !== "late") {
    filter.status = statusFilter;
  }

  const companyId = normalizeText(filters.companyId);
  const siteId = normalizeText(filters.siteId);
  const departmentId = normalizeText(filters.departmentId || filters.department);
  const subDepartmentId = normalizeText(filters.subDepartmentId || filters.subDepartment);
  const companyName = normalizeText(filters.companyName);

  if (companyId) filter.companyId = companyId;
  if (companyName) filter.companyName = companyName;
  if (siteId) filter.siteId = siteId;
  if (departmentId) filter.departmentId = departmentId;
  if (subDepartmentId) filter.subDepartmentId = subDepartmentId;

  return filter;
};

const countStatusRows = (rows = []) =>
  rows.reduce(
    (result, row) => {
      const statusKey = normalizeStatusKey(row.status);
      if (statusKey && Object.prototype.hasOwnProperty.call(result, statusKey)) {
        result[statusKey] += 1;
      }

      if (isLateStatusMatch(row)) {
        result.lateDerived += 1;
      }

      if (row.missingCheckOut) {
        result.missingCheckOut += 1;
      }

      return result;
    },
    {
      present: 0,
      absent: 0,
      half_day: 0,
      leave: 0,
      week_off: 0,
      holiday: 0,
      late: 0,
      on_duty: 0,
      pending: 0,
      lateDerived: 0,
      missingCheckOut: 0,
    }
  );

const buildBreakdownRows = (rows = [], groupKey, labelKey) => {
  const result = new Map();

  rows.forEach((row) => {
    const key = normalizeId(row[groupKey]) || `unknown:${normalizeText(row[labelKey]) || "Unmapped"}`;
    if (!result.has(key)) {
      result.set(key, {
        key,
        label: normalizeText(row[labelKey]) || "Unmapped",
        present: 0,
        absent: 0,
        halfDay: 0,
        leave: 0,
        late: 0,
        onDuty: 0,
        total: 0,
      });
    }

    const target = result.get(key);
    const statusKey = normalizeStatusKey(row.status);

    target.total += 1;
    if (statusKey === "present") target.present += 1;
    if (statusKey === "absent") target.absent += 1;
    if (statusKey === "half_day") target.halfDay += 1;
    if (statusKey === "leave") target.leave += 1;
    if (statusKey === "on_duty") target.onDuty += 1;
    if (isLateStatusMatch(row)) target.late += 1;
  });

  return [...result.values()].sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
  );
};

const getMonthDateRange = (monthValue) => {
  const rawMonthValue = normalizeText(monthValue);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(rawMonthValue);
  if (!monthMatch) {
    const error = new Error("Month must be in YYYY-MM format");
    error.status = 400;
    throw error;
  }

  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]) - 1;
  const startDate = new Date(year, month, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    fromDate: startDate,
    toDate: endDate,
  };
};

module.exports = {
  DEFAULT_ATTENDANCE_SETTINGS,
  REGULARIZATION_STATUS_LABELS,
  STATUS_LABELS,
  buildActor,
  buildAttendanceEmployeeFilter,
  buildBreakdownRows,
  buildDateTime,
  buildRecordFilter,
  endOfDay,
  formatDateLabel,
  formatDurationMinutes,
  formatEmployeeDisplayName,
  formatSiteDisplayName,
  getAttendanceEmployees,
  getAttendanceSettings,
  getDateKey,
  getDateRangeFromQuery,
  getMonthDateRange,
  getRegularizationStatusLabel,
  getStatusLabel,
  mapAttendanceRecord,
  mergeDailyAttendanceRows,
  normalizeId,
  normalizeStatusKey,
  prepareAttendanceRecordPayload,
  startOfDay,
  countStatusRows,
  isLateStatusMatch,
  toLocalDate,
  uniqueIdList,
};
