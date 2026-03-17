const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const Employee = require("../models/Employee");
const Site = require("../models/Site");

const SCHEDULE_TYPES = ["daily", "weekly", "monthly", "yearly", "custom"];
const CUSTOM_REPEAT_UNITS = ["daily", "weekly", "monthly", "yearly"];
const APPROVAL_HIERARCHIES = ["default", "custom"];
const TASK_STATUSES = ["open", "submitted", "approved", "rejected"];
const TASK_TIMELINESS_STATUSES = ["pending", "advanced", "on_time", "delay"];
const APPROVAL_STEP_STATUSES = ["waiting", "pending", "approved", "rejected"];
const PRIORITY_LEVELS = ["high", "medium", "low"];
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const schedulerIntervalMs = 60 * 1000;
const maxOccurrencesPerRun = 366;
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

let schedulerTimer = null;
let schedulerInFlight = false;

const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const checklistPopulateQuery = [
  {
    path: "assignedToEmployee",
    select: "employeeCode employeeName department departmentDisplay superiorEmployee sites",
    populate: [
      { path: "department", select: "name" },
      { path: "superiorEmployee", select: "employeeCode employeeName" },
      { path: "sites", select: "name companyName" },
    ],
  },
  {
    path: "approvals.approvalEmployee",
    select: "employeeCode employeeName email",
  },
  {
    path: "employeeAssignedSite",
    select: "name companyName",
  },
  {
    path: "checklistSourceSite",
    select: "name companyName",
  },
];

const checklistTaskPopulateQuery = [
  {
    path: "checklist",
    select:
      "checklistNumber checklistName scheduleType scheduleTime startDate endDate endTime status approvalHierarchy priority",
  },
  {
    path: "assignedEmployee",
    select: "employeeCode employeeName department superiorEmployee",
    populate: [
      { path: "department", select: "name" },
      { path: "superiorEmployee", select: "employeeCode employeeName" },
    ],
  },
  {
    path: "currentApprovalEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "approvalSteps.approverEmployee",
    select: "employeeCode employeeName",
  },
];

const pad = (value) => String(value).padStart(2, "0");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (value) =>
  objectIdPattern.test(String(value || "").trim());

const getRequesterRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();

const isAdminRequester = (user) => getRequesterRole(user) === "admin";

const isEmployeeRequester = (user) => getRequesterRole(user) === "employee";

const normalizeText = (value) => String(value || "").trim();

const capitalize = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const ordinal = (value) => {
  const day = Number(value);
  if (Number.isNaN(day)) return value;
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
};

const getWeekDayIndex = (value) =>
  WEEK_DAYS.findIndex(
    (day) => day.toLowerCase() === normalizeText(value).toLowerCase()
  );

const getWeekDayLabel = (value) => {
  const index = getWeekDayIndex(value);
  return index >= 0 ? WEEK_DAYS[index] : "";
};

const getMonthLabel = (value) => {
  const monthIndex = Number(value) - 1;
  return monthIndex >= 0 && monthIndex < MONTH_LABELS.length
    ? MONTH_LABELS[monthIndex]
    : "";
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["true", "1", "yes", "on"].includes(normalized);
};

const parseJsonArray = (rawValue) => {
  if (Array.isArray(rawValue)) return rawValue;
  if (rawValue && typeof rawValue === "object") return [rawValue];
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildIstDateTime = ({
  year,
  monthIndex,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
}) =>
  new Date(
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) -
      IST_OFFSET_MS
  );

const getIstShiftedDate = (value) => new Date(new Date(value).getTime() + IST_OFFSET_MS);

const getIstDateParts = (value) => {
  const shiftedDate = getIstShiftedDate(value);

  return {
    year: shiftedDate.getUTCFullYear(),
    monthIndex: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
    hours: shiftedDate.getUTCHours(),
    minutes: shiftedDate.getUTCMinutes(),
    dayOfWeek: shiftedDate.getUTCDay(),
  };
};

const resolveDateParts = (value) => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger(value.year) &&
    Number.isInteger(value.monthIndex) &&
    Number.isInteger(value.day)
  ) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const { year, monthIndex, day } = getIstDateParts(value);
    return { year, monthIndex, day };
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

    const [year, month, day] = normalized.split("-").map(Number);
    if (!year || !month || !day) return null;

    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return { year, monthIndex: month - 1, day };
  }

  return null;
};

const parseDateBoundary = (value, boundary = "start") => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed =
    boundary === "end"
      ? buildIstDateTime({
          year,
          monthIndex: month - 1,
          day,
          hours: 23,
          minutes: 59,
          seconds: 59,
          milliseconds: 999,
        })
      : buildIstDateTime({
          year,
          monthIndex: month - 1,
          day,
        });

  const parsedParts = getIstDateParts(parsed);
  if (
    parsedParts.year !== year ||
    parsedParts.monthIndex !== month - 1 ||
    parsedParts.day !== day
  ) {
    return null;
  }

  return parsed;
};

const parseDateInput = (value) => resolveDateParts(value);

const normalizeTimeInput = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const match = normalized.match(timePattern);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  if (!twelveHourMatch) return "";

  let hours = Number(twelveHourMatch[1]);
  const minutes = twelveHourMatch[2];
  const suffix = twelveHourMatch[3].toUpperCase();

  if (hours < 1 || hours > 12) return "";
  if (suffix === "AM") {
    hours = hours === 12 ? 0 : hours;
  } else if (hours !== 12) {
    hours += 12;
  }

  return `${pad(hours)}:${minutes}`;
};

const formatTimeLabel = (value) => {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return "";

  const [hoursValue, minutesValue] = normalized.split(":").map(Number);
  const suffix = hoursValue >= 12 ? "PM" : "AM";
  const displayHour = hoursValue % 12 === 0 ? 12 : hoursValue % 12;

  return `${pad(displayHour)}:${pad(minutesValue)} ${suffix}`;
};

const combineDateAndTime = (dateValue, timeValue) => {
  const date = resolveDateParts(dateValue);
  const time = normalizeTimeInput(timeValue);

  if (!date || !time) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return buildIstDateTime({
    year: date.year,
    monthIndex: date.monthIndex,
    day: date.day,
    hours,
    minutes,
  });
};

const compareIstCalendarDate = (leftValue, rightValue) => {
  const left = getIstDateParts(leftValue);
  const right = getIstDateParts(rightValue);

  if (left.year !== right.year) return left.year - right.year;
  if (left.monthIndex !== right.monthIndex) return left.monthIndex - right.monthIndex;
  return left.day - right.day;
};

const buildOccurrenceKey = (dateValue) => {
  const date = getIstDateParts(dateValue);
  return [
    date.year,
    pad(date.monthIndex + 1),
    pad(date.day),
    pad(date.hours),
    pad(date.minutes),
  ].join("");
};

const buildTaskNumber = (checklistNumber, dateValue) =>
  `${normalizeText(checklistNumber)}-${buildOccurrenceKey(dateValue)}`;

const getChecklistWindowMs = (checklist) => {
  const scheduledStart = combineDateAndTime(checklist.startDate, checklist.scheduleTime);
  const scheduledEnd = combineDateAndTime(checklist.endDate, checklist.endTime);

  if (!scheduledStart || !scheduledEnd) return 0;
  return Math.max(0, scheduledEnd.getTime() - scheduledStart.getTime());
};

const buildTaskEndDateTime = (checklist, occurrenceDate) => {
  const durationMs = getChecklistWindowMs(checklist);
  return new Date(new Date(occurrenceDate).getTime() + durationMs);
};

const getTaskTimelinessStatus = ({ submittedAt, endDateTime }) => {
  if (!submittedAt || !endDateTime) return "pending";

  const dayComparison = compareIstCalendarDate(submittedAt, endDateTime);
  if (dayComparison < 0) return "advanced";
  if (dayComparison > 0) return "delay";

  return new Date(submittedAt).getTime() <= new Date(endDateTime).getTime()
    ? "on_time"
    : "delay";
};

const buildChecklistNumberPrefix = (siteName) => {
  const tokens =
    normalizeText(siteName)
      .match(/[A-Za-z0-9]+/g)
      ?.filter(Boolean) || [];

  if (!tokens.length) {
    return "CL";
  }

  if (tokens.length === 1) {
    const token = tokens[0].toUpperCase();
    return token.length <= 3 ? token : token.slice(0, 3);
  }

  return tokens
    .map((token) => token.charAt(0).toUpperCase())
    .join("")
    .slice(0, 4);
};

const buildCustomRepeatSummary = ({
  customRepeatInterval = 1,
  customRepeatUnit = "daily",
  repeatDayOfMonth = null,
  repeatDayOfWeek = "",
  repeatMonthOfYear = null,
}) => {
  const interval = Math.max(1, Number(customRepeatInterval) || 1);
  const unit = normalizeText(customRepeatUnit).toLowerCase() || "daily";
  const labels = {
    daily: { singular: "day", plural: "days", base: "Every day" },
    weekly: { singular: "week", plural: "weeks", base: "Every week" },
    monthly: { singular: "month", plural: "months", base: "Every month" },
    yearly: { singular: "year", plural: "years", base: "Every year" },
  };
  const unitLabel = labels[unit] || labels.daily;
  const baseSummary =
    interval === 1 ? unitLabel.base : `Every ${interval} ${unitLabel.plural}`;

  if (unit === "weekly" && repeatDayOfWeek) {
    return `${baseSummary} on ${repeatDayOfWeek}`;
  }

  if (unit === "monthly" && repeatDayOfMonth) {
    return `${baseSummary} on the ${ordinal(repeatDayOfMonth)}`;
  }

  if (unit === "yearly" && repeatMonthOfYear && repeatDayOfMonth) {
    return `${baseSummary} on ${getMonthLabel(repeatMonthOfYear)} ${ordinal(
      repeatDayOfMonth
    )}`;
  }

  if (unit === "yearly" && repeatMonthOfYear) {
    return `${baseSummary} in ${getMonthLabel(repeatMonthOfYear)}`;
  }

  return baseSummary;
};

const buildRepeatSummary = ({
  scheduleType,
  startDate,
  customRepeatInterval,
  customRepeatUnit,
  repeatDayOfMonth,
  repeatDayOfWeek,
  repeatMonthOfYear,
}) => {
  const normalizedScheduleType = normalizeText(scheduleType).toLowerCase();
  const anchorDate = startDate ? getIstDateParts(startDate) : null;

  if (normalizedScheduleType === "custom") {
    return buildCustomRepeatSummary({
      customRepeatInterval,
      customRepeatUnit,
      repeatDayOfMonth,
      repeatDayOfWeek,
      repeatMonthOfYear,
    });
  }

  if (normalizedScheduleType === "weekly" && anchorDate) {
    return `Every ${WEEK_DAYS[anchorDate.dayOfWeek]}`;
  }

  if (normalizedScheduleType === "monthly" && anchorDate) {
    return `${ordinal(anchorDate.day)} of every month`;
  }

  if (normalizedScheduleType === "yearly" && anchorDate) {
    return `Every year on ${MONTH_LABELS[anchorDate.monthIndex]} ${ordinal(
      anchorDate.day
    )}`;
  }

  if (normalizedScheduleType === "daily") {
    return "Every day";
  }

  return capitalize(normalizedScheduleType);
};

const getDaysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate();

const buildAnchoredDate = ({
  year,
  monthIndex,
  dayOfMonth,
  scheduleTime,
}) => {
  const lastDay = getDaysInMonth(year, monthIndex);
  const safeDay = Math.min(dayOfMonth, lastDay);
  const [hours, minutes] = normalizeTimeInput(scheduleTime).split(":").map(Number);

  return buildIstDateTime({
    year,
    monthIndex,
    day: safeDay,
    hours,
    minutes,
  });
};

const getFirstCustomOccurrence = (checklist) => {
  const startOccurrence = combineDateAndTime(checklist.startDate, checklist.scheduleTime);
  if (!startOccurrence) return null;

  const unit = normalizeText(checklist.customRepeatUnit).toLowerCase() || "daily";

  if (unit === "weekly") {
    const targetDayIndex = getWeekDayIndex(checklist.repeatDayOfWeek);
    if (targetDayIndex < 0) return startOccurrence;

    const dayOffset =
      (targetDayIndex - getIstDateParts(startOccurrence).dayOfWeek + 7) % 7;
    return new Date(startOccurrence.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  }

  if (unit === "monthly") {
    const targetDayOfMonth = Number(checklist.repeatDayOfMonth || 0);
    if (!targetDayOfMonth) return startOccurrence;

    let { year, monthIndex } = getIstDateParts(startOccurrence);
    let occurrence = buildAnchoredDate({
      year,
      monthIndex,
      dayOfMonth: targetDayOfMonth,
      scheduleTime: checklist.scheduleTime,
    });

    if (occurrence < startOccurrence) {
      monthIndex += 1;
      if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }

      occurrence = buildAnchoredDate({
        year,
        monthIndex,
        dayOfMonth: targetDayOfMonth,
        scheduleTime: checklist.scheduleTime,
      });
    }

    return occurrence;
  }

  if (unit === "yearly") {
    const targetDayOfMonth = Number(checklist.repeatDayOfMonth || 0);
    const targetMonthOfYear = Number(checklist.repeatMonthOfYear || 0);
    if (!targetDayOfMonth || !targetMonthOfYear) return startOccurrence;

    let { year } = getIstDateParts(startOccurrence);
    let occurrence = buildAnchoredDate({
      year,
      monthIndex: targetMonthOfYear - 1,
      dayOfMonth: targetDayOfMonth,
      scheduleTime: checklist.scheduleTime,
    });

    if (occurrence < startOccurrence) {
      year += 1;
      occurrence = buildAnchoredDate({
        year,
        monthIndex: targetMonthOfYear - 1,
        dayOfMonth: targetDayOfMonth,
        scheduleTime: checklist.scheduleTime,
      });
    }

    return occurrence;
  }

  return startOccurrence;
};

const getFirstOccurrence = (checklist) => {
  const normalizedScheduleType = normalizeText(checklist.scheduleType).toLowerCase();

  if (normalizedScheduleType === "custom") {
    return getFirstCustomOccurrence(checklist);
  }

  return combineDateAndTime(checklist.startDate, checklist.scheduleTime);
};

const getNextOccurrence = (checklist, currentOccurrence) => {
  const occurrence = new Date(currentOccurrence);
  const anchorDate = getIstDateParts(checklist.startDate);
  const normalizedScheduleType = normalizeText(checklist.scheduleType).toLowerCase();

  if (normalizedScheduleType === "custom") {
    const interval = Math.max(1, Number(checklist.customRepeatInterval) || 1);
    const unit = normalizeText(checklist.customRepeatUnit).toLowerCase() || "daily";

    if (unit === "weekly") {
      return new Date(occurrence.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    }

    if (unit === "monthly") {
      const occurrenceParts = getIstDateParts(occurrence);
      const totalMonths = occurrenceParts.monthIndex + interval;
      const year = occurrenceParts.year + Math.floor(totalMonths / 12);
      const monthIndex = ((totalMonths % 12) + 12) % 12;
      return buildAnchoredDate({
        year,
        monthIndex,
        dayOfMonth: Number(checklist.repeatDayOfMonth || anchorDate.day),
        scheduleTime: checklist.scheduleTime,
      });
    }

    if (unit === "yearly") {
      const occurrenceParts = getIstDateParts(occurrence);
      return buildAnchoredDate({
        year: occurrenceParts.year + interval,
        monthIndex: Number(checklist.repeatMonthOfYear || anchorDate.monthIndex + 1) - 1,
        dayOfMonth: Number(checklist.repeatDayOfMonth || anchorDate.day),
        scheduleTime: checklist.scheduleTime,
      });
    }

    return new Date(occurrence.getTime() + interval * 24 * 60 * 60 * 1000);
  }

  switch (normalizedScheduleType) {
    case "weekly":
      return new Date(occurrence.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      {
        const occurrenceParts = getIstDateParts(occurrence);
        const totalMonths = occurrenceParts.monthIndex + 1;
        const year = occurrenceParts.year + Math.floor(totalMonths / 12);
        const monthIndex = totalMonths % 12;
        return buildAnchoredDate({
          year,
          monthIndex,
          dayOfMonth: anchorDate.day,
          scheduleTime: checklist.scheduleTime,
        });
      }
    case "yearly":
      return buildAnchoredDate({
        year: getIstDateParts(occurrence).year + 1,
        monthIndex: anchorDate.monthIndex,
        dayOfMonth: anchorDate.day,
        scheduleTime: checklist.scheduleTime,
      });
    case "daily":
    default:
      return new Date(occurrence.getTime() + 24 * 60 * 60 * 1000);
  }
};

const getPendingOccurrences = (checklist, now = new Date()) => {
  const firstOccurrence = getFirstOccurrence(checklist);
  if (!firstOccurrence) {
    return { occurrences: [], nextOccurrenceAt: null };
  }

  let nextOccurrence = checklist.lastGeneratedAt
    ? getNextOccurrence(checklist, checklist.lastGeneratedAt)
    : firstOccurrence;

  const occurrences = [];

  while (nextOccurrence && nextOccurrence <= now && occurrences.length < maxOccurrencesPerRun) {
    occurrences.push(nextOccurrence);
    nextOccurrence = getNextOccurrence(checklist, nextOccurrence);
  }

  return {
    occurrences,
    nextOccurrenceAt: nextOccurrence,
  };
};

const buildTaskItemsFromChecklist = (checklist) =>
  (checklist.checklistItems || []).map((item) => ({
    checklistItemId: item._id,
    label: item.label,
    detail: item.detail || "",
    isRequired: item.isRequired !== false,
    verified: false,
    remarks: "",
  }));

const buildApprovalStepsFromChecklist = (checklist) =>
  (checklist.approvals || []).map((row) => ({
    approvalLevel: Number(row.approvalLevel) || 1,
    approverEmployee: row.approvalEmployee,
    status: "waiting",
    remarks: "",
    actedAt: null,
  }));

const parseChecklistItems = (rawValue) =>
  parseJsonArray(rawValue)
    .map((item) => ({
      label: normalizeText(item?.label || item?.title || item?.name),
      detail: normalizeText(item?.detail || item?.description),
      isRequired: parseBoolean(item?.isRequired, true),
    }))
    .filter((item) => item.label);

const normalizeApprovalRows = (rows = []) =>
  rows
    .map((row, index) => ({
      approvalLevel: Number(row?.approvalLevel) || index + 1,
      approvalEmployee: normalizeText(
        row?.approvalEmployee?._id || row?.approvalEmployee || row?.approverEmployee
      ),
    }))
    .filter((row) => row.approvalEmployee);

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const resolveApprovalRows = async ({
  assignedEmployee,
  approvalHierarchy,
  approvals,
}) => {
  const normalizedHierarchy = normalizeText(approvalHierarchy).toLowerCase() || "default";

  if (!APPROVAL_HIERARCHIES.includes(normalizedHierarchy)) {
    return { message: "Invalid approval hierarchy", status: 400 };
  }

  if (normalizedHierarchy === "default") {
    const superiorEmployeeId = normalizeText(
      assignedEmployee?.superiorEmployee?._id || assignedEmployee?.superiorEmployee
    );

    if (!superiorEmployeeId) {
      return {
        message:
          "Approval mapping is incomplete. Configure a Department Head or Superior Employee for the selected employee.",
        status: 400,
      };
    }

    return {
      approvalHierarchy: "default",
      approvals: [
        {
          approvalLevel: 1,
          approvalEmployee: superiorEmployeeId,
        },
      ],
    };
  }

  const normalizedRows = normalizeApprovalRows(parseJsonArray(approvals));

  if (!normalizedRows.length) {
    return {
      message: "At least one approval employee is required for custom workflow mapping",
      status: 400,
    };
  }

  const approverIds = normalizedRows.map((row) => row.approvalEmployee);
  const uniqueApproverIds = [...new Set(approverIds)];

  if (approverIds.length !== uniqueApproverIds.length) {
    return {
      message: "Approval workflow cannot contain duplicate approvers",
      status: 400,
    };
  }

  if (uniqueApproverIds.includes(String(assignedEmployee._id))) {
    return {
      message: "Assigned employee cannot approve their own checklist",
      status: 400,
    };
  }

  const approvers = await Employee.find(
    { _id: { $in: uniqueApproverIds }, isActive: true },
    "_id"
  ).lean();

  if (approvers.length !== uniqueApproverIds.length) {
    return {
      message: "One or more selected approval employees are invalid or inactive",
      status: 400,
    };
  }

  return {
    approvalHierarchy: "custom",
    approvals: uniqueApproverIds.map((employeeId, index) => ({
      approvalLevel: index + 1,
      approvalEmployee: employeeId,
    })),
  };
};

const getNextChecklistNumberValue = async (siteId) => {
  const site = await Site.findById(siteId, "name").lean();

  if (!site) return null;

  const prefix = buildChecklistNumberPrefix(site.name);
  const pattern = new RegExp(`^${escapeRegex(prefix)}\\s*-\\s*(\\d+)$`, "i");

  const existingChecklists = await Checklist.find(
    {
      employeeAssignedSite: siteId,
      checklistNumber: { $regex: `^${escapeRegex(prefix)}\\s*-\\s*` },
    },
    "checklistNumber"
  ).lean();

  const maxSequence = existingChecklists.reduce((maxValue, row) => {
    const match = pattern.exec(normalizeText(row.checklistNumber));
    if (!match) return maxValue;

    const parsedValue = Number(match[1]);
    return Number.isNaN(parsedValue) ? maxValue : Math.max(maxValue, parsedValue);
  }, 0);

  return `${prefix} - ${String(maxSequence + 1).padStart(3, "0")}`;
};

const validateChecklistPayload = async ({ body }) => {
  const checklistName = normalizeText(body.checklistName);
  const checklistMark =
    body.checklistMark === undefined || body.checklistMark === null || body.checklistMark === ""
      ? 1
      : Number(body.checklistMark);
  const checklistSourceSite = normalizeText(body.checklistSourceSite);
  const assignedToEmployee = normalizeText(body.assignedToEmployee);
  const employeeAssignedSite = normalizeText(body.employeeAssignedSite);
  const scheduleType = normalizeText(body.scheduleType).toLowerCase();
  const priority = normalizeText(body.priority).toLowerCase() || "medium";
  const startDate = parseDateInput(body.startDate);
  const scheduleTime = normalizeTimeInput(body.scheduleTime);
  const endDate = parseDateInput(body.endDate);
  const endTime = normalizeTimeInput(body.endTime);
  const customRepeatInterval = Math.max(1, Number(body.customRepeatInterval || 1) || 1);
  const customRepeatUnit = normalizeText(body.customRepeatUnit).toLowerCase() || "daily";
  const repeatDayOfMonth = Number(body.repeatDayOfMonth || 0) || null;
  const repeatDayOfWeek = getWeekDayLabel(body.repeatDayOfWeek);
  const repeatMonthOfYear = Number(body.repeatMonthOfYear || 0) || null;
  const checklistItems = parseChecklistItems(body.checklistItems);

  if (
    !checklistName ||
    !assignedToEmployee ||
    !employeeAssignedSite ||
    !scheduleType ||
    !startDate ||
    !scheduleTime ||
    !endDate ||
    !endTime
  ) {
    return {
      message:
        "Checklist name, assigned site, employee, schedule, start date, start time, end date, and end time are required",
      status: 400,
    };
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    return { message: "Invalid schedule type", status: 400 };
  }

  if (!PRIORITY_LEVELS.includes(priority)) {
    return { message: "Invalid checklist priority", status: 400 };
  }

  if (!Number.isInteger(checklistMark) || checklistMark < 1 || checklistMark > 10) {
    return { message: "Checklist mark must be a whole number between 1 and 10", status: 400 };
  }

  if (
    scheduleType === "custom" &&
    (!CUSTOM_REPEAT_UNITS.includes(customRepeatUnit) || customRepeatInterval < 1)
  ) {
    return {
      message: "Custom schedule must include a valid repeat interval and unit",
      status: 400,
    };
  }

  if (scheduleType === "custom" && customRepeatUnit === "weekly" && !repeatDayOfWeek) {
    return {
      message: "Select a day of week for custom weekly schedule",
      status: 400,
    };
  }

  if (
    scheduleType === "custom" &&
    customRepeatUnit === "monthly" &&
    (!repeatDayOfMonth || repeatDayOfMonth < 1 || repeatDayOfMonth > 31)
  ) {
    return {
      message: "Select a valid day of month for custom monthly schedule",
      status: 400,
    };
  }

  if (
    scheduleType === "custom" &&
    customRepeatUnit === "yearly" &&
    (!repeatMonthOfYear ||
      repeatMonthOfYear < 1 ||
      repeatMonthOfYear > 12 ||
      !repeatDayOfMonth ||
      repeatDayOfMonth < 1 ||
      repeatDayOfMonth > 31)
  ) {
    return {
      message: "Select a valid month and day for custom yearly schedule",
      status: 400,
    };
  }

  if (!checklistItems.length) {
    return {
      message: "Add at least one checklist item so the employee can verify the task",
      status: 400,
    };
  }

  const assignedEmployee = await Employee.findById(
    assignedToEmployee,
    "employeeCode employeeName superiorEmployee sites isActive"
  );

  if (!assignedEmployee || !assignedEmployee.isActive) {
    return { message: "Assigned employee is invalid or inactive", status: 400 };
  }

  if (!isValidObjectId(employeeAssignedSite)) {
    return { message: "Selected assigned site is invalid", status: 400 };
  }

  if (checklistSourceSite && !isValidObjectId(checklistSourceSite)) {
    return { message: "Selected checklist source site is invalid", status: 400 };
  }

  const [assignedSite, sourceSite] = await Promise.all([
    Site.findById(employeeAssignedSite, "name companyName").lean(),
    checklistSourceSite
      ? Site.findById(checklistSourceSite, "name companyName").lean()
      : Promise.resolve(null),
  ]);

  if (!assignedSite) {
    return { message: "Selected assigned site was not found", status: 400 };
  }

  if (checklistSourceSite && !sourceSite) {
    return { message: "Selected checklist source site was not found", status: 400 };
  }

  if (!employeeHasSite(assignedEmployee, employeeAssignedSite)) {
    return {
      message: "Selected employee is not mapped to the selected assigned site",
      status: 400,
    };
  }

  const approvalResult = await resolveApprovalRows({
    assignedEmployee,
    approvalHierarchy: body.approvalHierarchy,
    approvals: body.approvals,
  });

  if (approvalResult.message) {
    return approvalResult;
  }

  const checklistNumber =
    normalizeText(body.checklistNumber) ||
    (await getNextChecklistNumberValue(employeeAssignedSite));

  if (!checklistNumber) {
    return { message: "Failed to generate checklist number", status: 400 };
  }

  const scheduledStart = combineDateAndTime(startDate, scheduleTime);
  const scheduledEnd = combineDateAndTime(endDate, endTime);

  if (!scheduledStart || !scheduledEnd || scheduledEnd <= scheduledStart) {
    return {
      message: "End date and end time must be later than start date and start task time",
      status: 400,
    };
  }

  const repeatSummary = buildRepeatSummary({
    scheduleType,
    startDate: scheduledStart,
    customRepeatInterval,
    customRepeatUnit,
    repeatDayOfMonth,
    repeatDayOfWeek,
    repeatMonthOfYear,
  });

  return {
    payload: {
      checklistNumber,
      checklistName,
      checklistMark,
      checklistSourceSite: checklistSourceSite || null,
      assignedToEmployee,
      employeeAssignedSite: employeeAssignedSite || null,
      scheduleType,
      priority,
      startDate: scheduledStart,
      scheduleTime,
      endDate: scheduledEnd,
      endTime,
      customRepeatInterval: scheduleType === "custom" ? customRepeatInterval : 1,
      customRepeatUnit: scheduleType === "custom" ? customRepeatUnit : "daily",
      repeatDayOfMonth:
        scheduleType === "custom" && ["monthly", "yearly"].includes(customRepeatUnit)
          ? repeatDayOfMonth
          : null,
      repeatDayOfWeek:
        scheduleType === "custom" && customRepeatUnit === "weekly" ? repeatDayOfWeek : "",
      repeatMonthOfYear:
        scheduleType === "custom" && customRepeatUnit === "yearly" ? repeatMonthOfYear : null,
      repeatSummary,
      checklistItems,
      approvalHierarchy: approvalResult.approvalHierarchy,
      approvals: approvalResult.approvals,
    },
  };
};

const createChecklistTask = async (checklist, occurrenceDate) => {
  const endDateTime = buildTaskEndDateTime(checklist, occurrenceDate);
  const taskPayload = {
    taskNumber: buildTaskNumber(checklist.checklistNumber, occurrenceDate),
    checklist: checklist._id,
    checklistNumber: checklist.checklistNumber,
    checklistName: checklist.checklistName,
    scheduleType: checklist.scheduleType,
    repeatSummary: checklist.repeatSummary || "",
    priority: checklist.priority || "medium",
    occurrenceDate,
    occurrenceKey: buildOccurrenceKey(occurrenceDate),
    endDateTime,
    assignedEmployee: checklist.assignedToEmployee,
    currentApprovalEmployee: null,
    status: "open",
    checklistItems: buildTaskItemsFromChecklist(checklist),
    employeeRemarks: "",
    employeeAttachments: [],
    submittedAt: null,
    timelinessStatus: "pending",
    approvalSteps: buildApprovalStepsFromChecklist(checklist),
    completedAt: null,
  };

  try {
    await ChecklistTask.create(taskPayload);
    return 1;
  } catch (err) {
    if (err?.code === 11000) return 0;
    throw err;
  }
};

const runChecklistScheduler = async ({ checklistIds = [] } = {}) => {
  if (schedulerInFlight) {
    return { processed: 0, created: 0, skipped: true };
  }

  schedulerInFlight = true;

  try {
    const filter = {
      status: true,
      scheduleType: { $in: SCHEDULE_TYPES },
      startDate: { $ne: null },
      scheduleTime: { $ne: "" },
    };

    if (Array.isArray(checklistIds) && checklistIds.length) {
      filter._id = { $in: checklistIds };
    }

    const checklists = await Checklist.find(filter);
    const now = new Date();
    let created = 0;

    for (const checklist of checklists) {
      const { occurrences, nextOccurrenceAt } = getPendingOccurrences(checklist, now);

      for (const occurrenceDate of occurrences) {
        created += await createChecklistTask(checklist, occurrenceDate);
      }

      const firstOccurrence = getFirstOccurrence(checklist);
      const updatedNextOccurrenceAt = nextOccurrenceAt || firstOccurrence;

      if (occurrences.length) {
        checklist.lastGeneratedAt = occurrences[occurrences.length - 1];
      }

      checklist.nextOccurrenceAt = updatedNextOccurrenceAt;
      await checklist.save();
    }

    return {
      processed: checklists.length,
      created,
      skipped: false,
    };
  } finally {
    schedulerInFlight = false;
  }
};

const startChecklistScheduler = () => {
  if (schedulerTimer) return;

  void runChecklistScheduler();

  schedulerTimer = setInterval(() => {
    void runChecklistScheduler();
  }, schedulerIntervalMs);
};

const stopChecklistScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

const parseTaskItemResponses = (rawValue) =>
  parseJsonArray(rawValue).map((item) => ({
    checklistItemId: normalizeText(item?.checklistItemId || item?.id),
    verified: parseBoolean(item?.verified, false),
    remarks: normalizeText(item?.remarks),
  }));

const applyTaskSubmission = ({ task, body, files = [] }) => {
  const responses = parseTaskItemResponses(body.itemResponses);
  const responseMap = new Map(
    responses
      .filter((item) => item.checklistItemId)
      .map((item) => [String(item.checklistItemId), item])
  );

  const nextItems = task.checklistItems.map((item) => {
    const response = responseMap.get(String(item.checklistItemId || item._id)) || {};

    return {
      ...item.toObject(),
      verified: response.verified === true,
      remarks: response.remarks || "",
    };
  });

  const missingRequiredItem = nextItems.find(
    (item) => item.isRequired && item.verified !== true
  );

  if (missingRequiredItem) {
    return {
      message: `Required item "${missingRequiredItem.label}" must be verified before submission`,
      status: 400,
    };
  }

  const firstPendingStepIndex = task.approvalSteps.findIndex(
    (step) => step.status === "waiting"
  );

  if (firstPendingStepIndex === -1) {
    return {
      message: "Approval workflow mapping is not configured for this checklist",
      status: 400,
    };
  }

  task.checklistItems = nextItems;
  task.employeeRemarks = normalizeText(body.employeeRemarks);
  task.employeeAttachments = (files || []).map((file) => ({
    fileName: file.filename,
    originalName: file.originalname,
  }));
  task.submittedAt = new Date();
  task.timelinessStatus = getTaskTimelinessStatus({
    submittedAt: task.submittedAt,
    endDateTime: task.endDateTime,
  });
  task.status = "submitted";
  task.currentApprovalEmployee = task.approvalSteps[firstPendingStepIndex].approverEmployee;
  task.approvalSteps = task.approvalSteps.map((step, index) => ({
    ...step.toObject(),
    status: index === firstPendingStepIndex ? "pending" : step.status,
  }));

  return { payload: task };
};

const canAccessChecklistTask = (task, user) => {
  if (isAdminRequester(user)) return true;

  const requesterId = normalizeText(user?.id);
  if (!requesterId) return false;

  if (String(task.assignedEmployee?._id || task.assignedEmployee) === requesterId) {
    return true;
  }

  if (
    String(task.currentApprovalEmployee?._id || task.currentApprovalEmployee) ===
    requesterId
  ) {
    return true;
  }

  return (task.approvalSteps || []).some((step) => {
    const approverId = String(step.approverEmployee?._id || step.approverEmployee);
    return approverId === requesterId && step.status !== "waiting";
  });
};

const applyChecklistDecision = ({ task, action, remarks }) => {
  const normalizedAction = normalizeText(action).toLowerCase();
  if (!["approve", "reject"].includes(normalizedAction)) {
    return { message: "Approval action must be approve or reject", status: 400 };
  }

  const currentStepIndex = task.approvalSteps.findIndex(
    (step) => step.status === "pending"
  );

  if (currentStepIndex === -1) {
    return { message: "No pending approval step found for this checklist", status: 400 };
  }

  const now = new Date();
  const nextSteps = task.approvalSteps.map((step, index) => {
    if (index !== currentStepIndex) return step.toObject();

    return {
      ...step.toObject(),
      status: normalizedAction === "approve" ? "approved" : "rejected",
      remarks: normalizeText(remarks),
      actedAt: now,
    };
  });

  task.approvalSteps = nextSteps;

  if (normalizedAction === "reject") {
    task.status = "rejected";
    task.currentApprovalEmployee = null;
    task.completedAt = now;
    return { payload: task };
  }

  const nextWaitingStep = nextSteps.find((step) => step.status === "waiting");

  if (nextWaitingStep) {
    task.approvalSteps = nextSteps.map((step) => ({
      ...step,
      status:
        step.approvalLevel === nextWaitingStep.approvalLevel ? "pending" : step.status,
    }));
    task.currentApprovalEmployee = nextWaitingStep.approverEmployee;
    task.status = "submitted";
    task.completedAt = null;
    return { payload: task };
  }

  task.status = "approved";
  task.currentApprovalEmployee = null;
  task.completedAt = now;
  return { payload: task };
};

module.exports = {
  APPROVAL_STEP_STATUSES,
  SCHEDULE_TYPES,
  TASK_STATUSES,
  TASK_TIMELINESS_STATUSES,
  applyChecklistDecision,
  applyTaskSubmission,
  buildTaskNumber,
  canAccessChecklistTask,
  checklistPopulateQuery,
  checklistTaskPopulateQuery,
  formatTimeLabel,
  getNextChecklistNumberValue,
  isAdminRequester,
  isEmployeeRequester,
  isValidObjectId,
  parseDateBoundary,
  runChecklistScheduler,
  startChecklistScheduler,
  stopChecklistScheduler,
  validateChecklistPayload,
};
