const ExcelJS = require("exceljs");
const { Types } = require("mongoose");
const Complaint = require("../models/Complaint");
const ComplaintNotification = require("../models/ComplaintNotification");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Role = require("../models/Role");
const Site = require("../models/Site");
const User = require("../models/User");
const {
  MAIN_ADMIN_REMINDER_STAGE,
  buildComplaintDeadlineFields,
  formatDurationLabel,
  getComplaintDeadlineState,
} = require("../services/complaintLifecycle.service");

const COMPLAINT_WORKFLOW_STATUSES = {
  pending_department_head: "Pending Department Head",
  pending_site_head: "Pending Site Head",
  pending_main_admin: "Pending Main Admin",
  completed: "Resolved / Completed",
};

const LEVEL_LABELS = {
  department_head: "Department Head",
  site_head: "Site Head",
  main_admin: "Main Admin",
  completed: "Completed",
};

const COMPLAINT_BUSINESS_STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  overdue: "Overdue",
};

const COMPLAINT_REPORT_EXCEL_SHEET_NAME = "Complaint Report";
const COMPLAINT_REPORT_SORT_FIELDS = new Set([
  "complaintCode",
  "employeeName",
  "companyName",
  "siteDisplayName",
  "departmentName",
  "raisedAt",
  "currentLevel",
  "businessStatus",
  "overdueStatus",
  "completedAt",
]);

const NOTIFICATION_STAGE_LABELS = {
  pending_department_head: "Pending Department Head",
  pending_site_head: "Pending Site Head",
  pending_main_admin: "Pending Main Admin",
  [MAIN_ADMIN_REMINDER_STAGE]: "Main Admin Reminder",
  completed_employee: "Resolved / Completed",
};

const normalizeText = (value) => String(value || "").trim();
const normalizeId = (value) => String(value?._id || value || "").trim();

const uniqueIdList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const normalizeNameList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const isValidObjectId = (value) => Types.ObjectId.isValid(normalizeText(value));

const formatEmployeeLabel = (employee) => {
  const employeeCode = normalizeText(employee?.employeeCode);
  const employeeName = normalizeText(employee?.employeeName);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName || "";
};

const formatSiteDisplayName = (site) => {
  const companyName = normalizeText(site?.companyName);
  const siteName = normalizeText(site?.name);

  if (companyName && siteName) return `${companyName} - ${siteName}`;
  return siteName || companyName || "";
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const toValidDate = (value) => {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBoolean = (value) =>
  ["true", "1", "yes"].includes(normalizeText(value).toLowerCase());

const parseDateBoundary = (value, boundary = "start") => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;

  const parsed = new Date(`${normalizedValue}T00:00:00.000+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;

  if (boundary === "end") {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
};

const getComplaintBusinessStatus = (row = {}) => {
  if (normalizeText(row?.status).toLowerCase() === "completed") {
    return "resolved";
  }

  if (row?.isOverdue) {
    return "overdue";
  }

  if (normalizeText(row?.currentLevel).toLowerCase() === "department_head") {
    return "open";
  }

  return "in_progress";
};

const getComplaintOverdueStatusLabel = (deadlineState = {}) => {
  if (deadlineState.completed && deadlineState.isOverdue) {
    return "Resolved After Time Limit";
  }

  if (deadlineState.completed) {
    return "Resolved Within Time Limit";
  }

  if (deadlineState.isOverdue) {
    return "Overdue";
  }

  return "Within Time Limit";
};

const buildComplaintSlaClockLabel = (deadlineState = {}) => {
  if (deadlineState.completed && deadlineState.isOverdue) {
    return `Overdue by ${formatDurationLabel(deadlineState.overdueMs)} before resolution`;
  }

  if (deadlineState.completed) {
    return `Resolved in ${formatDurationLabel(deadlineState.elapsedMs)}`;
  }

  if (deadlineState.isOverdue) {
    return `Overdue by ${formatDurationLabel(deadlineState.overdueMs)}`;
  }

  return `Remaining ${formatDurationLabel(deadlineState.remainingMs)}`;
};

const buildIdentitySet = (employee = {}) =>
  new Set(
    [
      formatEmployeeLabel(employee),
      normalizeText(employee?.employeeName),
      normalizeText(employee?.employeeCode),
      normalizeText(employee?.email),
    ]
      .map((value) => value.toLowerCase())
      .filter(Boolean)
  );

const isMainAdminPrincipal = (user = {}) =>
  user?.principalType === "user" &&
  (Boolean(user?.isDefaultAdmin) ||
    normalizeText(user?.roleKey).toLowerCase() === "main_admin" ||
    normalizeText(user?.role).toLowerCase() === "admin");

const buildComplaintCode = () =>
  `CMP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

const buildAttachmentPayload = (file) => {
  if (!file) return null;

  return {
    filename: normalizeText(file.filename),
    originalName: normalizeText(file.originalname),
    mimetype: normalizeText(file.mimetype),
    size: Number(file.size || 0),
    url: file.filename ? `/uploads/${file.filename}` : "",
  };
};

const buildRemarkSnapshot = ({ action, remark, user, actedAt }) => ({
  action,
  remark: normalizeText(remark),
  actedByPrincipalType: user?.principalType === "employee" ? "employee" : "user",
  actedByPrincipalId: user?.id || null,
  actedByName: normalizeText(user?.name || user?.email || user?.employeeCode),
  actedAt,
});

const buildTimelineEntry = ({ level, action, remark, user, actedAt }) => ({
  level,
  action,
  remark: normalizeText(remark),
  actedByPrincipalType: user?.principalType === "employee" ? "employee" : "user",
  actedByPrincipalId: user?.id || null,
  actedByName: normalizeText(user?.name || user?.email || user?.employeeCode),
  actedAt,
});

const buildNotificationTitle = (stage, complaint) => {
  const complaintCode = normalizeText(complaint?.complaintCode);
  const employeeName = normalizeText(complaint?.employeeName);

  if (stage === "completed_employee") {
    return `Complaint ${complaintCode} resolved`;
  }

  return `${NOTIFICATION_STAGE_LABELS[stage]}: ${employeeName || complaintCode}`;
};

const buildNotificationMessage = (stage, complaint) => {
  const departmentName = normalizeText(complaint?.departmentName);
  const siteLabel = normalizeText(complaint?.siteDisplayName);
  const complaintText = normalizeText(complaint?.complaintText);
  const trimmedComplaint =
    complaintText.length > 120 ? `${complaintText.slice(0, 117).trimEnd()}...` : complaintText;

  if (stage === "completed_employee") {
    return `Your complaint for ${departmentName || "the selected department"} has been marked resolved.`;
  }

  return [departmentName, siteLabel, trimmedComplaint].filter(Boolean).join(" | ");
};

const buildNotificationRoutePath = (complaintId) =>
  `/complaints/reports?complaintId=${normalizeId(complaintId)}`;

const buildComplaintVisibilityQuery = (user = {}) => {
  const principalId = normalizeId(user?.id);
  if (!principalId) return { _id: null };

  const or = [];
  if (user?.principalType === "employee") {
    or.push({ employee: new Types.ObjectId(principalId) });
    or.push({ "routing.departmentHeadPrincipalId": new Types.ObjectId(principalId) });
    or.push({ "routing.siteHeadPrincipalId": new Types.ObjectId(principalId) });
  }

  if (isMainAdminPrincipal(user)) {
    or.push({ "routing.mainAdminPrincipalIds": new Types.ObjectId(principalId) });
  }

  if (!or.length) {
    return { _id: null };
  }

  return or.length === 1 ? or[0] : { $or: or };
};

const getComplaintAssignmentMeta = (complaint, user = {}) => {
  const principalId = normalizeId(user?.id);
  const isEmployeePrincipal = user?.principalType === "employee";
  const isDepartmentHeadAssignee =
    isEmployeePrincipal &&
    normalizeId(complaint?.routing?.departmentHeadPrincipalId) === principalId;
  const isSiteHeadAssignee =
    isEmployeePrincipal && normalizeId(complaint?.routing?.siteHeadPrincipalId) === principalId;
  const isMainAdminAssignee =
    isMainAdminPrincipal(user) &&
    uniqueIdList(complaint?.routing?.mainAdminPrincipalIds).includes(principalId);
  const isOwner =
    user?.principalType === "employee" && normalizeId(complaint?.employee) === principalId;

  const canAct =
    (complaint?.currentLevel === "department_head" && isDepartmentHeadAssignee) ||
    (complaint?.currentLevel === "site_head" && isSiteHeadAssignee) ||
    (complaint?.currentLevel === "main_admin" && isMainAdminAssignee);

  return {
    isOwner,
    isDepartmentHeadAssignee,
    isSiteHeadAssignee,
    isMainAdminAssignee,
    canAct,
  };
};

const mapRemarkEntry = (label, remark = null) => {
  if (!remark?.actedAt && !normalizeText(remark?.remark) && !normalizeText(remark?.actedByName)) {
    return null;
  }

  return {
    label,
    action: normalizeText(remark?.action),
    actionLabel:
      normalizeText(remark?.action) === "complete"
        ? "Completed"
        : normalizeText(remark?.action) === "forward"
        ? "Forwarded"
        : "Submitted",
    remark: normalizeText(remark?.remark),
    actedByName: normalizeText(remark?.actedByName),
    actedAt: remark?.actedAt || null,
    actedAtLabel: formatDateTime(remark?.actedAt),
  };
};

const mapComplaintRow = (complaint, user = {}) => {
  const assignmentMeta = getComplaintAssignmentMeta(complaint, user);
  const latestTimeline = Array.isArray(complaint?.timeline)
    ? complaint.timeline[complaint.timeline.length - 1] || null
    : null;
  const deadlineState = getComplaintDeadlineState(complaint, new Date());
  const businessStatus = getComplaintBusinessStatus({
    status: complaint?.status,
    currentLevel: complaint?.currentLevel,
    isOverdue: deadlineState.isOverdue,
  });

  return {
    _id: normalizeId(complaint?._id),
    complaintCode: normalizeText(complaint?.complaintCode),
    employeeId: normalizeId(complaint?.employee),
    employeeName: normalizeText(complaint?.employeeName),
    employeeCode: normalizeText(complaint?.employeeCode),
    employeeLabel: formatEmployeeLabel(complaint),
    companyName: normalizeText(complaint?.siteCompanyName),
    departmentId: normalizeId(complaint?.department),
    departmentName: normalizeText(complaint?.departmentName),
    siteId: normalizeId(complaint?.site),
    siteName: normalizeText(complaint?.siteName),
    siteDisplayName: normalizeText(complaint?.siteDisplayName),
    complaintText: normalizeText(complaint?.complaintText),
    currentLevel: normalizeText(complaint?.currentLevel),
    currentLevelLabel: LEVEL_LABELS[complaint?.currentLevel] || "Pending",
    status: normalizeText(complaint?.status),
    workflowStatusLabel:
      COMPLAINT_WORKFLOW_STATUSES[complaint?.status] || normalizeText(complaint?.status),
    businessStatus,
    businessStatusLabel:
      COMPLAINT_BUSINESS_STATUS_LABELS[businessStatus] || "In Progress",
    statusCode: deadlineState.statusCode,
    statusLabel: deadlineState.statusLabel,
    deadlineStatus: deadlineState.statusCode,
    deadlineStatusLabel: deadlineState.statusLabel,
    overdueStatus: deadlineState.completed
      ? deadlineState.isOverdue
        ? "resolved_after_sla"
        : "resolved_within_sla"
      : deadlineState.isOverdue
      ? "overdue"
      : "within_sla",
    overdueStatusLabel: getComplaintOverdueStatusLabel(deadlineState),
    slaClockLabel: buildComplaintSlaClockLabel(deadlineState),
    departmentHeadName: normalizeText(complaint?.routing?.departmentHeadName),
    siteHeadName: normalizeText(complaint?.routing?.siteHeadName),
    mainAdminNames: normalizeNameList(complaint?.routing?.mainAdminNames),
    departmentHeadRemark: normalizeText(complaint?.remarks?.departmentHead?.remark),
    siteHeadRemark: normalizeText(complaint?.remarks?.siteHead?.remark),
    mainAdminRemark: normalizeText(complaint?.remarks?.mainAdmin?.remark),
    createdAt: complaint?.createdAt || null,
    createdAtLabel: formatDateTime(complaint?.createdAt),
    updatedAt: complaint?.updatedAt || null,
    updatedAtLabel: formatDateTime(complaint?.updatedAt),
    completedAt: complaint?.completedAt || null,
    completedAtLabel: formatDateTime(complaint?.completedAt),
    raisedAt: deadlineState.raisedAt,
    raisedAtLabel: formatDateTime(deadlineState.raisedAt),
    deadlineAt: deadlineState.deadlineAt,
    deadlineAtLabel: formatDateTime(deadlineState.deadlineAt),
    remainingMs: deadlineState.remainingMs,
    remainingLabel: deadlineState.remainingMs > 0 ? formatDurationLabel(deadlineState.remainingMs) : "",
    overdueMs: deadlineState.overdueMs,
    overdueLabel: deadlineState.overdueMs > 0 ? formatDurationLabel(deadlineState.overdueMs) : "",
    elapsedMs: deadlineState.elapsedMs,
    elapsedLabel: formatDurationLabel(deadlineState.elapsedMs),
    isDueSoon: deadlineState.isDueSoon,
    isOverdue: deadlineState.isOverdue,
    reminderLastSentAt: complaint?.reminderLastSentAt || null,
    reminderLastSentAtLabel: formatDateTime(complaint?.reminderLastSentAt),
    reminderCount: Number(complaint?.reminderCount || 0),
    isActionRequired: assignmentMeta.canAct,
    isOwner: assignmentMeta.isOwner,
    lastAction: latestTimeline
      ? {
          level: normalizeText(latestTimeline.level),
          action: normalizeText(latestTimeline.action),
          actedByName: normalizeText(latestTimeline.actedByName),
          actedAt: latestTimeline.actedAt || null,
          actedAtLabel: formatDateTime(latestTimeline.actedAt),
        }
      : null,
  };
};

const mapComplaintDetail = (complaint, user = {}) => {
  const assignmentMeta = getComplaintAssignmentMeta(complaint, user);
  const remarks = [
    mapRemarkEntry("Department Head Remark", complaint?.remarks?.departmentHead),
    mapRemarkEntry("Site Head Remark", complaint?.remarks?.siteHead),
    mapRemarkEntry("Main Admin Remark", complaint?.remarks?.mainAdmin),
  ].filter(Boolean);

  return {
    ...mapComplaintRow(complaint, user),
    attachment: complaint?.attachment
      ? {
          filename: normalizeText(complaint.attachment.filename),
          originalName: normalizeText(complaint.attachment.originalName),
          url: normalizeText(complaint.attachment.url),
          mimetype: normalizeText(complaint.attachment.mimetype),
          size: Number(complaint.attachment.size || 0),
        }
      : null,
    canAct: assignmentMeta.canAct,
    availableActions:
      complaint?.currentLevel === "department_head" || complaint?.currentLevel === "site_head"
        ? ["submit", "forward"]
        : complaint?.currentLevel === "main_admin"
        ? ["complete"]
        : [],
    remarks,
    timeline: (Array.isArray(complaint?.timeline) ? complaint.timeline : []).map((item) => ({
      level: normalizeText(item.level),
      levelLabel: LEVEL_LABELS[item.level] || normalizeText(item.level),
      action: normalizeText(item.action),
      actionLabel:
        normalizeText(item.action) === "created"
          ? "Created"
          : normalizeText(item.action) === "complete"
          ? "Completed"
          : normalizeText(item.action) === "forward"
          ? "Forwarded"
          : "Submitted",
      remark: normalizeText(item.remark),
      actedByName: normalizeText(item.actedByName),
      actedAt: item.actedAt || null,
      actedAtLabel: formatDateTime(item.actedAt),
    })),
  };
};

const parseComplaintFilters = (query = {}) => {
  const requestedStatus = normalizeText(
    query?.complaintStatus || query?.businessStatus || query?.status
  ).toLowerCase();
  const requestedWorkflowStatus = normalizeText(query?.workflowStatus).toLowerCase();
  const requestedLevel = normalizeText(
    query?.level || query?.complaintLevel || query?.currentLevel
  ).toLowerCase();
  const requestedSortBy = normalizeText(query?.sortBy);

  return {
    fromDate: normalizeText(query?.fromDate),
    toDate: normalizeText(query?.toDate),
    company: normalizeText(query?.company),
    site: normalizeId(query?.site),
    department: normalizeId(query?.department),
    employeeName: normalizeText(query?.employeeName),
    search: normalizeText(query?.search),
    complaintStatus: Object.prototype.hasOwnProperty.call(
      COMPLAINT_BUSINESS_STATUS_LABELS,
      requestedStatus
    )
      ? requestedStatus
      : "",
    workflowStatus:
      Object.prototype.hasOwnProperty.call(COMPLAINT_WORKFLOW_STATUSES, requestedWorkflowStatus)
        ? requestedWorkflowStatus
        : !Object.prototype.hasOwnProperty.call(COMPLAINT_BUSINESS_STATUS_LABELS, requestedStatus) &&
          Object.prototype.hasOwnProperty.call(COMPLAINT_WORKFLOW_STATUSES, requestedStatus)
        ? requestedStatus
        : "",
    level: Object.prototype.hasOwnProperty.call(LEVEL_LABELS, requestedLevel)
      ? requestedLevel
      : "",
    overdueOnly: parseBoolean(query?.overdueOnly),
    actionRequiredOnly: parseBoolean(query?.actionRequiredOnly),
    sortBy: COMPLAINT_REPORT_SORT_FIELDS.has(requestedSortBy)
      ? requestedSortBy
      : "raisedAt",
    sortDirection:
      normalizeText(query?.sortDirection).toLowerCase() === "asc" ? "asc" : "desc",
  };
};

const buildComplaintSearchText = (row = {}) =>
  [
    row?.complaintCode,
    row?.employeeName,
    row?.employeeCode,
    row?.companyName,
    row?.siteDisplayName,
    row?.departmentName,
    row?.complaintText,
    row?.currentLevelLabel,
    row?.workflowStatusLabel,
    row?.businessStatusLabel,
    row?.departmentHeadRemark,
    row?.siteHeadRemark,
    row?.mainAdminRemark,
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

const applyComplaintReportFilters = (rows = [], filters = {}) => {
  const fromDateBoundary = parseDateBoundary(filters?.fromDate, "start");
  const toDateBoundary = parseDateBoundary(filters?.toDate, "end");
  const normalizedCompany = normalizeText(filters?.company).toLowerCase();
  const normalizedEmployeeName = normalizeText(filters?.employeeName).toLowerCase();
  const normalizedSearch = normalizeText(filters?.search).toLowerCase();

  return rows.filter((row) => {
    const raisedAt = toValidDate(row?.raisedAt);

    if (fromDateBoundary && (!raisedAt || raisedAt < fromDateBoundary)) {
      return false;
    }

    if (toDateBoundary && (!raisedAt || raisedAt > toDateBoundary)) {
      return false;
    }

    if (
      normalizedCompany &&
      normalizeText(row?.companyName).toLowerCase() !== normalizedCompany
    ) {
      return false;
    }

    if (filters?.site && normalizeId(row?.siteId) !== normalizeId(filters.site)) {
      return false;
    }

    if (
      filters?.department &&
      normalizeId(row?.departmentId) !== normalizeId(filters.department)
    ) {
      return false;
    }

    if (filters?.complaintStatus && row?.businessStatus !== filters.complaintStatus) {
      return false;
    }

    if (filters?.workflowStatus && row?.status !== filters.workflowStatus) {
      return false;
    }

    if (filters?.level && row?.currentLevel !== filters.level) {
      return false;
    }

    if (
      normalizedEmployeeName &&
      !normalizeText(row?.employeeName).toLowerCase().includes(normalizedEmployeeName)
    ) {
      return false;
    }

    if (filters?.overdueOnly && !row?.isOverdue) {
      return false;
    }

    if (filters?.actionRequiredOnly && !row?.isActionRequired) {
      return false;
    }

    if (normalizedSearch && !buildComplaintSearchText(row).includes(normalizedSearch)) {
      return false;
    }

    return true;
  });
};

const compareComplaintSortValues = (leftValue, rightValue) => {
  if (typeof leftValue === "number" || typeof rightValue === "number") {
    return Number(leftValue || 0) - Number(rightValue || 0);
  }

  return String(leftValue || "").localeCompare(String(rightValue || ""), "en-IN", {
    numeric: true,
    sensitivity: "base",
  });
};

const getComplaintSortValue = (row = {}, sortBy = "raisedAt") => {
  if (sortBy === "raisedAt" || sortBy === "completedAt") {
    return toValidDate(row?.[sortBy])?.getTime() || 0;
  }

  if (sortBy === "currentLevel") {
    return (
      {
        department_head: 1,
        site_head: 2,
        main_admin: 3,
        completed: 4,
      }[normalizeText(row?.currentLevel).toLowerCase()] || 0
    );
  }

  if (sortBy === "businessStatus") {
    return (
      {
        open: 1,
        in_progress: 2,
        overdue: 3,
        resolved: 4,
      }[normalizeText(row?.businessStatus).toLowerCase()] || 0
    );
  }

  if (sortBy === "overdueStatus") {
    return (
      {
        within_sla: 1,
        overdue: 2,
        resolved_within_sla: 3,
        resolved_after_sla: 4,
      }[normalizeText(row?.overdueStatus).toLowerCase()] || 0
    );
  }

  return row?.[sortBy] || "";
};

const sortComplaintRows = (rows = [], sortBy = "raisedAt", sortDirection = "desc") =>
  [...rows].sort((leftRow, rightRow) => {
    const comparison = compareComplaintSortValues(
      getComplaintSortValue(leftRow, sortBy),
      getComplaintSortValue(rightRow, sortBy)
    );

    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : comparison * -1;
    }

    return (
      (toValidDate(rightRow?.raisedAt)?.getTime() || 0) -
      (toValidDate(leftRow?.raisedAt)?.getTime() || 0)
    );
  });

const buildComplaintFilterOptions = (rows = []) => {
  const companyMap = new Map();
  const siteMap = new Map();
  const departmentMap = new Map();
  const employeeMap = new Map();

  rows.forEach((row) => {
    const companyName = normalizeText(row?.companyName);
    if (companyName) {
      companyMap.set(companyName.toLowerCase(), {
        value: companyName,
        label: companyName,
      });
    }

    const siteId = normalizeId(row?.siteId);
    if (siteId) {
      siteMap.set(siteId, {
        value: siteId,
        label: normalizeText(row?.siteDisplayName) || normalizeText(row?.siteName) || siteId,
      });
    }

    const departmentId = normalizeId(row?.departmentId);
    if (departmentId) {
      departmentMap.set(departmentId, {
        value: departmentId,
        label: normalizeText(row?.departmentName) || departmentId,
      });
    }

    const employeeId = normalizeId(row?.employeeId);
    if (employeeId) {
      employeeMap.set(employeeId, {
        value: employeeId,
        label: row?.employeeLabel || normalizeText(row?.employeeName) || employeeId,
      });
    }
  });

  const sortOptions = (items = []) =>
    [...items].sort((left, right) =>
      String(left?.label || "").localeCompare(String(right?.label || ""), "en-IN", {
        sensitivity: "base",
        numeric: true,
      })
    );

  return {
    companies: sortOptions([...companyMap.values()]),
    sites: sortOptions([...siteMap.values()]),
    departments: sortOptions([...departmentMap.values()]),
    employees: sortOptions([...employeeMap.values()]),
    complaintStatuses: Object.entries(COMPLAINT_BUSINESS_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    complaintLevels: Object.entries(LEVEL_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  };
};

const buildComplaintSummary = (rows = []) => {
  const total = rows.length;
  const open = rows.filter((row) => row.businessStatus === "open").length;
  const inProgress = rows.filter((row) => row.businessStatus === "in_progress").length;
  const resolved = rows.filter((row) => row.businessStatus === "resolved").length;
  const overdue = rows.filter((row) => row.businessStatus === "overdue").length;
  const pendingDepartmentHead = rows.filter((row) => row.currentLevel === "department_head").length;
  const pendingSiteHead = rows.filter((row) => row.currentLevel === "site_head").length;
  const pendingMainAdmin = rows.filter((row) => row.currentLevel === "main_admin").length;
  const actionRequired = rows.filter((row) => row.isActionRequired).length;

  return {
    total,
    open,
    inProgress,
    resolved,
    overdue,
    pendingDepartmentHead,
    pendingSiteHead,
    pendingMainAdmin,
    actionRequired,
    completed: resolved,
  };
};

const buildComplaintDashboardCards = (summary = {}) => [
  {
    key: "total",
    label: "Total Complaints",
    value: Number(summary?.total || 0),
    tone: "neutral",
    drilldownFilters: {},
  },
  {
    key: "open",
    label: "Open Complaints",
    value: Number(summary?.open || 0),
    tone: "info",
    drilldownFilters: { complaintStatus: "open" },
  },
  {
    key: "in_progress",
    label: "In Progress Complaints",
    value: Number(summary?.inProgress || 0),
    tone: "primary",
    drilldownFilters: { complaintStatus: "in_progress" },
  },
  {
    key: "resolved",
    label: "Resolved Complaints",
    value: Number(summary?.resolved || 0),
    tone: "success",
    drilldownFilters: { complaintStatus: "resolved" },
  },
  {
    key: "overdue",
    label: "Overdue Complaints",
    value: Number(summary?.overdue || 0),
    tone: "danger",
    drilldownFilters: { complaintStatus: "overdue" },
  },
  {
    key: "pending_department_head",
    label: "Complaints Pending Department Head",
    value: Number(summary?.pendingDepartmentHead || 0),
    tone: "warning",
    drilldownFilters: { level: "department_head" },
  },
  {
    key: "pending_site_head",
    label: "Complaints Pending Site Head",
    value: Number(summary?.pendingSiteHead || 0),
    tone: "secondary",
    drilldownFilters: { level: "site_head" },
  },
  {
    key: "pending_main_admin",
    label: "Complaints Pending Main Admin",
    value: Number(summary?.pendingMainAdmin || 0),
    tone: "dark",
    drilldownFilters: { level: "main_admin" },
  },
];

const buildRankedComplaintCounts = (
  rows = [],
  labelSelector = () => "",
  maxItems = 6
) => {
  const countMap = new Map();

  rows.forEach((row) => {
    const label = normalizeText(labelSelector(row)) || "Unassigned";
    const key = label.toLowerCase();

    countMap.set(key, {
      name: label,
      count: Number(countMap.get(key)?.count || 0) + 1,
    });
  });

  const rankedItems = [...countMap.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.name.localeCompare(right.name, "en-IN", { sensitivity: "base" })
  );

  if (rankedItems.length <= maxItems) {
    return rankedItems;
  }

  const headItems = rankedItems.slice(0, maxItems - 1);
  const otherCount = rankedItems
    .slice(maxItems - 1)
    .reduce((sum, item) => sum + Number(item.count || 0), 0);

  return [...headItems, { name: "Others", count: otherCount }];
};

const buildMonthlyComplaintTrend = (rows = []) => {
  const monthMap = new Map();
  const monthFormatter = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  rows.forEach((row) => {
    const raisedAt = toValidDate(row?.raisedAt);
    if (!raisedAt) return;

    const key = `${raisedAt.getUTCFullYear()}-${String(raisedAt.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        monthKey: key,
        monthLabel: monthFormatter.format(raisedAt),
        count: 0,
      });
    }

    monthMap.get(key).count += 1;
  });

  const rowsByMonth = [...monthMap.values()].sort((left, right) =>
    left.monthKey.localeCompare(right.monthKey, "en-IN", { numeric: true })
  );

  return rowsByMonth.slice(-12);
};

const buildPendingLevelSummary = (rows = []) =>
  [
    {
      level: "department_head",
      label: "Department Head",
      count: rows.filter((row) => row.currentLevel === "department_head").length,
    },
    {
      level: "site_head",
      label: "Site Head",
      count: rows.filter((row) => row.currentLevel === "site_head").length,
    },
    {
      level: "main_admin",
      label: "Main Admin",
      count: rows.filter((row) => row.currentLevel === "main_admin").length,
    },
  ];

const buildComplaintReportFilterSummary = (filters = {}) => {
  const parts = [];

  if (filters?.fromDate || filters?.toDate) {
    parts.push(
      `Date: ${filters?.fromDate || "Any"} to ${filters?.toDate || "Any"}`
    );
  }

  if (filters?.company) {
    parts.push(`Company: ${filters.company}`);
  }

  if (filters?.site) {
    parts.push(`Site ID: ${filters.site}`);
  }

  if (filters?.department) {
    parts.push(`Department ID: ${filters.department}`);
  }

  if (filters?.complaintStatus) {
    parts.push(
      `Status: ${COMPLAINT_BUSINESS_STATUS_LABELS[filters.complaintStatus] || filters.complaintStatus}`
    );
  }

  if (filters?.workflowStatus) {
    parts.push(
      `Workflow: ${COMPLAINT_WORKFLOW_STATUSES[filters.workflowStatus] || filters.workflowStatus}`
    );
  }

  if (filters?.level) {
    parts.push(`Level: ${LEVEL_LABELS[filters.level] || filters.level}`);
  }

  if (filters?.employeeName) {
    parts.push(`Employee: ${filters.employeeName}`);
  }

  if (filters?.search) {
    parts.push(`Search: ${filters.search}`);
  }

  if (filters?.overdueOnly) {
    parts.push("Overdue Only");
  }

  return parts.length ? parts.join(" | ") : "All visible complaints";
};

const complaintReportExcelColumns = [
  { header: "#", key: "serialNumber", width: 8 },
  { header: "Complaint ID", key: "complaintCode", width: 24 },
  { header: "Raised By", key: "raisedBy", width: 28 },
  { header: "Company", key: "companyName", width: 24 },
  { header: "Site", key: "siteName", width: 28 },
  { header: "Department", key: "departmentName", width: 24 },
  { header: "Complaint Subject / Description", key: "complaintText", width: 44 },
  { header: "Raised Date & Time", key: "raisedAtLabel", width: 22 },
  { header: "Current Level", key: "currentLevelLabel", width: 20 },
  { header: "Workflow Status", key: "workflowStatusLabel", width: 22 },
  { header: "Status", key: "businessStatusLabel", width: 18 },
  { header: "Overdue Status", key: "overdueStatusLabel", width: 20 },
  { header: "Time Limit", key: "slaClockLabel", width: 26 },
  { header: "Final Resolution Date", key: "completedAtLabel", width: 22 },
  { header: "Department Head Remark", key: "departmentHeadRemark", width: 28 },
  { header: "Site Head Remark", key: "siteHeadRemark", width: 28 },
  { header: "Main Admin Remark", key: "mainAdminRemark", width: 28 },
];

const buildComplaintReportExportRow = (row = {}, index = 0) => ({
  serialNumber: index + 1,
  complaintCode: row?.complaintCode || "-",
  raisedBy: row?.employeeLabel || row?.employeeName || "-",
  companyName: row?.companyName || "-",
  siteName: row?.siteDisplayName || row?.siteName || "-",
  departmentName: row?.departmentName || "-",
  complaintText: row?.complaintText || "-",
  raisedAtLabel: row?.raisedAtLabel || "-",
  currentLevelLabel: row?.currentLevelLabel || "-",
  workflowStatusLabel: row?.workflowStatusLabel || "-",
  businessStatusLabel: row?.businessStatusLabel || "-",
  overdueStatusLabel: row?.overdueStatusLabel || "-",
  slaClockLabel: row?.slaClockLabel || "-",
  completedAtLabel: row?.completedAtLabel || "-",
  departmentHeadRemark: row?.departmentHeadRemark || "-",
  siteHeadRemark: row?.siteHeadRemark || "-",
  mainAdminRemark: row?.mainAdminRemark || "-",
});

const escapePdfText = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");

const wrapPdfText = (text, maxChars = 96) => {
  const normalizedValue = String(text || "").trim();
  if (!normalizedValue) return [""];

  const words = normalizedValue.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }

    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const buildPdfContentStream = (lines = []) => {
  let content = "BT\n40 560 Td\n";
  let currentFont = "";
  let currentSize = 0;

  lines.forEach((line, index) => {
    const font = line.font || "F1";
    const size = line.size || 10;
    const gap = Number(line.gap || 12);

    if (font !== currentFont || size !== currentSize) {
      content += `/${font} ${size} Tf\n`;
      currentFont = font;
      currentSize = size;
    }

    if (index > 0) {
      content += `0 -${gap} Td\n`;
    }

    content += `(${escapePdfText(line.text)}) Tj\n`;
  });

  content += "ET";
  return content;
};

const buildSimplePdfBuffer = (pageContents = []) => {
  const contents = pageContents.length ? pageContents : [buildPdfContentStream([])];
  const objectMap = {};
  let objectId = 1;

  const catalogId = objectId++;
  const pagesId = objectId++;
  const fontRegularId = objectId++;
  const fontBoldId = objectId++;
  const pageIds = contents.map(() => objectId++);
  const contentIds = contents.map(() => objectId++);

  objectMap[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objectMap[pagesId] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;
  objectMap[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  objectMap[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  contents.forEach((content, index) => {
    objectMap[
      pageIds[index]
    ] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objectMap[contentIds[index]] = `<< /Length ${Buffer.byteLength(
      content,
      "utf8"
    )} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objectMap[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objectId}\n0000000000 65535 f \n`;

  for (let id = 1; id < objectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

const buildComplaintReportPdfPages = (rows = [], filters = {}) => {
  const pages = [];
  const maxLinesPerPage = 38;
  const generatedAtLabel = formatDateTime(new Date());
  const filterSummary = buildComplaintReportFilterSummary(filters);
  let currentPage = [];

  const createPageHeader = () => [
    { text: "Complaint Report", font: "F2", size: 16, gap: 0 },
    { text: `Generated: ${generatedAtLabel}`, font: "F1", size: 10, gap: 18 },
    { text: `Filters: ${filterSummary}`, font: "F1", size: 9, gap: 14 },
    { text: `Total Complaints: ${rows.length}`, font: "F1", size: 9, gap: 12 },
    { text: "", font: "F1", size: 10, gap: 12 },
  ];

  const startNewPage = () => {
    currentPage = createPageHeader();
  };

  const ensurePageCapacity = (requiredLineCount) => {
    if (!currentPage.length) {
      startNewPage();
      return;
    }

    if (currentPage.length + requiredLineCount > maxLinesPerPage) {
      pages.push(buildPdfContentStream(currentPage));
      startNewPage();
    }
  };

  if (!rows.length) {
    startNewPage();
    currentPage.push({
      text: "No complaint records found for the selected filters.",
      font: "F1",
      size: 10,
      gap: 12,
    });
    pages.push(buildPdfContentStream(currentPage));
    return pages;
  }

  rows.forEach((row, index) => {
    const block = [];
    const addWrappedBlock = (text, font = "F1", size = 10, gap = 12) => {
      wrapPdfText(text).forEach((segment, segmentIndex) => {
        block.push({
          text: segment,
          font,
          size,
          gap: segmentIndex === 0 ? gap : 11,
        });
      });
    };

    addWrappedBlock(
      `${index + 1}. ${row.complaintCode} | ${row.businessStatusLabel} | ${row.currentLevelLabel}`,
      "F2",
      11,
      12
    );
    addWrappedBlock(`Raised By: ${row.employeeLabel || row.employeeName || "-"}`);
    addWrappedBlock(
      `Company: ${row.companyName || "-"} | Site: ${row.siteDisplayName || row.siteName || "-"}`
    );
    addWrappedBlock(`Department: ${row.departmentName || "-"}`);
    addWrappedBlock(`Raised: ${row.raisedAtLabel || "-"} | Resolved: ${row.completedAtLabel || "-"}`);
    addWrappedBlock(
      `Workflow: ${row.workflowStatusLabel || "-"} | Time Limit: ${row.overdueStatusLabel || "-"}`
    );
    addWrappedBlock(`Time Limit Clock: ${row.slaClockLabel || "-"}`);
    addWrappedBlock(`Complaint: ${row.complaintText || "-"}`);

    if (row.departmentHeadRemark) {
      addWrappedBlock(`Department Head Remark: ${row.departmentHeadRemark}`);
    }

    if (row.siteHeadRemark) {
      addWrappedBlock(`Site Head Remark: ${row.siteHeadRemark}`);
    }

    if (row.mainAdminRemark) {
      addWrappedBlock(`Main Admin Remark: ${row.mainAdminRemark}`);
    }

    block.push({ text: "", font: "F1", size: 10, gap: 12 });

    ensurePageCapacity(block.length);
    currentPage.push(...block);
  });

  if (currentPage.length) {
    pages.push(buildPdfContentStream(currentPage));
  }

  return pages;
};

const loadComplaintReportData = async (user = {}, query = {}) => {
  const selectedFilters = parseComplaintFilters(query);
  const visibilityFilter = buildComplaintVisibilityQuery(user);

  if (visibilityFilter._id === null) {
    return {
      rows: [],
      selectedFilters,
      filterOptions: buildComplaintFilterOptions([]),
      summary: buildComplaintSummary([]),
      cards: buildComplaintDashboardCards(buildComplaintSummary([])),
      charts: {
        statusWise: [],
        departmentWise: [],
        siteWise: [],
        monthlyTrend: [],
        pendingLevelWise: buildPendingLevelSummary([]),
      },
    };
  }

  const complaints = await Complaint.find(visibilityFilter).sort({ updatedAt: -1 }).lean();
  const scopedRows = complaints.map((complaint) => mapComplaintRow(complaint, user));
  const filteredRows = applyComplaintReportFilters(scopedRows, selectedFilters);
  const sortedRows = sortComplaintRows(
    filteredRows,
    selectedFilters.sortBy,
    selectedFilters.sortDirection
  );
  const summary = buildComplaintSummary(sortedRows);

  return {
    rows: sortedRows,
    selectedFilters,
    filterOptions: buildComplaintFilterOptions(scopedRows),
    summary,
    cards: buildComplaintDashboardCards(summary),
    charts: {
      statusWise: [
        { key: "open", label: "Open", value: summary.open },
        { key: "in_progress", label: "In Progress", value: summary.inProgress },
        { key: "resolved", label: "Resolved", value: summary.resolved },
        { key: "overdue", label: "Overdue", value: summary.overdue },
      ],
      departmentWise: buildRankedComplaintCounts(sortedRows, (row) => row.departmentName),
      siteWise: buildRankedComplaintCounts(sortedRows, (row) => row.siteDisplayName),
      monthlyTrend: buildMonthlyComplaintTrend(sortedRows),
      pendingLevelWise: buildPendingLevelSummary(sortedRows),
    },
  };
};

const loadCurrentEmployeeContext = async (employeeId) => {
  const employee = await Employee.findById(employeeId, "employeeCode employeeName email sites")
    .populate("sites", "name companyName")
    .lean();

  if (!employee || employee.isActive === false) {
    throw createHttpError("Employee profile not found", 404);
  }

  const sites = Array.isArray(employee.sites) ? employee.sites : [];
  const primarySite = sites[0] || null;

  return {
    employee,
    primarySite,
  };
};

const resolveEmployeeAssigneeFromNames = async ({
  candidateNames = [],
  employeeFilter = {},
  missingMessage,
}) => {
  const normalizedNames = normalizeNameList(candidateNames);
  if (!normalizedNames.length) {
    throw createHttpError(missingMessage, 400);
  }

  const employees = await Employee.find(
    {
      isActive: { $ne: false },
      ...employeeFilter,
    },
    "employeeCode employeeName email"
  ).lean();

  for (const candidateName of normalizedNames) {
    const normalizedCandidate = candidateName.toLowerCase();
    const matchedEmployee = employees.find((employee) =>
      buildIdentitySet(employee).has(normalizedCandidate)
    );

    if (matchedEmployee) {
      return matchedEmployee;
    }
  }

  throw createHttpError(missingMessage, 400);
};

const loadMainAdminAssignees = async () => {
  const mainAdminRole = await Role.findOne({ key: "main_admin" }, "_id").lean();
  const adminFilter = mainAdminRole?._id
    ? {
        $or: [{ role: "admin" }, { roleId: mainAdminRole._id }, { isDefaultAdmin: true }],
      }
    : { $or: [{ role: "admin" }, { isDefaultAdmin: true }] };

  const rows = await User.find(adminFilter, "name email role isDefaultAdmin").lean();
  const deduped = [];
  const seen = new Set();

  rows.forEach((row) => {
    const rowId = normalizeId(row._id);
    if (!rowId || seen.has(rowId)) return;
    seen.add(rowId);
    deduped.push(row);
  });

  if (!deduped.length) {
    throw createHttpError("No main admin is mapped for complaint escalation", 400);
  }

  return deduped;
};

const createComplaintNotificationsForStage = async ({ complaint, stage }) => {
  const complaintId = normalizeId(complaint?._id);
  if (!complaintId) return;

  const routePath = buildNotificationRoutePath(complaintId);
  const title = buildNotificationTitle(stage, complaint);
  const message = buildNotificationMessage(stage, complaint);
  const rows = [];

  if (stage === "pending_department_head") {
    const principalId = normalizeId(complaint?.routing?.departmentHeadPrincipalId);
    if (principalId) {
      rows.push({
        complaint: complaintId,
        recipientPrincipalType: complaint?.routing?.departmentHeadPrincipalType || "employee",
        recipientPrincipalId: principalId,
        stage,
        title,
        message,
        routePath,
      });
    }
  }

  if (stage === "pending_site_head") {
    const principalId = normalizeId(complaint?.routing?.siteHeadPrincipalId);
    if (principalId) {
      rows.push({
        complaint: complaintId,
        recipientPrincipalType: complaint?.routing?.siteHeadPrincipalType || "employee",
        recipientPrincipalId: principalId,
        stage,
        title,
        message,
        routePath,
      });
    }
  }

  if (stage === "pending_main_admin") {
    uniqueIdList(complaint?.routing?.mainAdminPrincipalIds).forEach((principalId) => {
      rows.push({
        complaint: complaintId,
        recipientPrincipalType: "user",
        recipientPrincipalId: principalId,
        stage,
        title,
        message,
        routePath,
      });
    });
  }

  if (stage === "completed_employee") {
    const employeeId = normalizeId(complaint?.employee);
    if (employeeId) {
      rows.push({
        complaint: complaintId,
        recipientPrincipalType: "employee",
        recipientPrincipalId: employeeId,
        stage,
        title,
        message,
        routePath,
      });
    }
  }

  if (rows.length) {
    await ComplaintNotification.insertMany(rows);
  }
};

const markComplaintNotificationsReadForPrincipal = async ({
  complaintId,
  principalType,
  principalId,
}) => {
  if (!normalizeId(complaintId) || !normalizeId(principalId)) return;

  await ComplaintNotification.updateMany(
    {
      complaint: complaintId,
      recipientPrincipalType: principalType,
      recipientPrincipalId: principalId,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    }
  );
};

const ensureComplaintAccess = async (complaintId, user = {}) => {
  if (!isValidObjectId(complaintId)) {
    throw createHttpError("Complaint not found", 404);
  }

  const complaint = await Complaint.findOne({
    _id: complaintId,
    ...buildComplaintVisibilityQuery(user),
  }).lean();

  if (!complaint) {
    throw createHttpError("Complaint not found", 404);
  }

  return complaint;
};

exports.getComplaintOptions = async (req, res) => {
  try {
    const departments = await Department.find(
      { isActive: { $ne: false } },
      "name"
    )
      .sort({ name: 1 })
      .lean();
    const reportData = await loadComplaintReportData(req.user, {});

    if (req.user?.principalType !== "employee") {
      return res.json({
        currentEmployee: null,
        departments: departments.map((department) => ({
          value: normalizeId(department._id),
          label: normalizeText(department.name),
        })),
        filterOptions: reportData.filterOptions,
      });
    }

    const { employee, primarySite } = await loadCurrentEmployeeContext(req.user.id);

    return res.json({
      currentEmployee: {
        employeeId: normalizeId(employee._id),
        employeeName: normalizeText(employee.employeeName),
        employeeCode: normalizeText(employee.employeeCode),
        siteId: normalizeId(primarySite?._id),
        siteDisplayName: formatSiteDisplayName(primarySite),
      },
      departments: departments.map((department) => ({
        value: normalizeId(department._id),
        label: normalizeText(department.name),
      })),
      filterOptions: reportData.filterOptions,
    });
  } catch (err) {
    console.error("GET COMPLAINT OPTIONS ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to load complaint form options",
    });
  }
};

exports.createComplaint = async (req, res) => {
  try {
    if (req.user?.principalType !== "employee") {
      return res.status(403).json({ message: "Only employees can submit complaints" });
    }

    const departmentId = normalizeText(req.body?.departmentId || req.body?.department);
    const complaintText = normalizeText(req.body?.complaintText || req.body?.complaintBox);

    if (!departmentId || !isValidObjectId(departmentId)) {
      return res.status(400).json({ message: "Select a valid department" });
    }

    if (!complaintText) {
      return res.status(400).json({ message: "Complaint details are required" });
    }

    const [{ employee, primarySite }, department] = await Promise.all([
      loadCurrentEmployeeContext(req.user.id),
      Department.findById(departmentId, "name headNames departmentLeadNames").lean(),
    ]);

    if (!primarySite) {
      return res.status(400).json({
        message: "No site is mapped to your employee profile for complaint routing",
      });
    }

    if (!department || department.isActive === false) {
      return res.status(400).json({ message: "Selected department is invalid" });
    }

    const site = await Site.findById(
      primarySite._id,
      "companyName name headNames siteLeadNames"
    ).lean();

    if (!site) {
      return res.status(400).json({ message: "Selected employee site is invalid" });
    }

    const [departmentHead, siteHead, mainAdmins] = await Promise.all([
      resolveEmployeeAssigneeFromNames({
        candidateNames: [
          ...(Array.isArray(department.headNames) ? department.headNames : []),
          ...(Array.isArray(department.departmentLeadNames)
            ? department.departmentLeadNames
            : []),
        ],
        employeeFilter: { department: department._id },
        missingMessage:
          "No active department head is mapped for the selected department",
      }),
      resolveEmployeeAssigneeFromNames({
        candidateNames: [
          ...(Array.isArray(site.headNames) ? site.headNames : []),
          ...(Array.isArray(site.siteLeadNames) ? site.siteLeadNames : []),
        ],
        employeeFilter: { sites: site._id },
        missingMessage: "No active site head is mapped for the employee site",
      }),
      loadMainAdminAssignees(),
    ]);

    const now = new Date();
    const deadlineFields = buildComplaintDeadlineFields(now);

    const complaint = await Complaint.create({
      complaintCode: buildComplaintCode(),
      employee: employee._id,
      employeeName: normalizeText(employee.employeeName),
      employeeCode: normalizeText(employee.employeeCode),
      site: site._id,
      siteName: normalizeText(site.name),
      siteCompanyName: normalizeText(site.companyName),
      siteDisplayName: formatSiteDisplayName(site),
      department: department._id,
      departmentName: normalizeText(department.name),
      complaintText,
      attachment: buildAttachmentPayload(req.file),
      currentLevel: "department_head",
      status: "pending_department_head",
      routing: {
        departmentHeadPrincipalType: "employee",
        departmentHeadPrincipalId: departmentHead._id,
        departmentHeadName: formatEmployeeLabel(departmentHead),
        siteHeadPrincipalType: "employee",
        siteHeadPrincipalId: siteHead._id,
        siteHeadName: formatEmployeeLabel(siteHead),
        mainAdminPrincipalIds: mainAdmins.map((row) => row._id),
        mainAdminNames: mainAdmins.map((row) => normalizeText(row.name || row.email)),
      },
      timeline: [
        buildTimelineEntry({
          level: "employee",
          action: "created",
          remark: complaintText,
          user: req.user,
          actedAt: now,
        }),
      ],
      raisedAt: deadlineFields.raisedAt,
      deadlineAt: deadlineFields.deadlineAt,
      isOverdue: deadlineFields.isOverdue,
      reminderLastSentAt: deadlineFields.reminderLastSentAt,
      reminderCount: deadlineFields.reminderCount,
      lastMovedAt: now,
    });

    await createComplaintNotificationsForStage({
      complaint,
      stage: "pending_department_head",
    });

    return res.status(201).json({
      message: "Complaint submitted successfully",
      complaint: mapComplaintRow(complaint.toObject(), req.user),
    });
  } catch (err) {
    console.error("CREATE COMPLAINT ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to submit complaint",
    });
  }
};

exports.getComplaints = async (req, res) => {
  try {
    const reportData = await loadComplaintReportData(req.user, req.query);

    return res.json({
      summary: reportData.summary,
      rows: reportData.rows,
      filterOptions: reportData.filterOptions,
      selectedFilters: reportData.selectedFilters,
    });
  } catch (err) {
    console.error("GET COMPLAINTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load complaints" });
  }
};

exports.getComplaintDashboard = async (req, res) => {
  try {
    const reportData = await loadComplaintReportData(req.user, req.query);

    return res.json({
      summary: reportData.summary,
      cards: reportData.cards,
      charts: reportData.charts,
      filterOptions: reportData.filterOptions,
      selectedFilters: reportData.selectedFilters,
    });
  } catch (err) {
    console.error("GET COMPLAINT DASHBOARD ERROR:", err);
    return res.status(500).json({ message: "Failed to load complaint dashboard" });
  }
};

exports.exportComplaintsExcel = async (req, res) => {
  try {
    const reportData = await loadComplaintReportData(req.user, req.query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Check List Workspace";

    const worksheet = workbook.addWorksheet(COMPLAINT_REPORT_EXCEL_SHEET_NAME);
    worksheet.columns = complaintReportExcelColumns;
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.getRow(1).font = { bold: true };
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: complaintReportExcelColumns.length },
    };

    reportData.rows.forEach((row, index) => {
      const worksheetRow = worksheet.addRow(buildComplaintReportExportRow(row, index));
      worksheetRow.alignment = {
        vertical: "top",
        wrapText: true,
      };

      if (row.isOverdue) {
        worksheetRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFCE8E6" },
          };
        });
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="complaint-report.xlsx"');

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error("EXPORT COMPLAINTS EXCEL ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export complaint report in Excel format" });
  }
};

exports.exportComplaintsPdf = async (req, res) => {
  try {
    const reportData = await loadComplaintReportData(req.user, req.query);
    const pdfBuffer = buildSimplePdfBuffer(
      buildComplaintReportPdfPages(reportData.rows, reportData.selectedFilters)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="complaint-report.pdf"');

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("EXPORT COMPLAINTS PDF ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export complaint report in PDF format" });
  }
};

exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await ensureComplaintAccess(req.params.id, req.user);

    await markComplaintNotificationsReadForPrincipal({
      complaintId: complaint._id,
      principalType: req.user?.principalType === "employee" ? "employee" : "user",
      principalId: req.user?.id,
    });

    return res.json(mapComplaintDetail(complaint, req.user));
  } catch (err) {
    console.error("GET COMPLAINT BY ID ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to load complaint details",
    });
  }
};

exports.progressComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const visibleComplaint = await ensureComplaintAccess(req.params.id, req.user);
    const assignmentMeta = getComplaintAssignmentMeta(visibleComplaint, req.user);
    if (!assignmentMeta.canAct) {
      return res.status(403).json({ message: "You cannot act on this complaint at this stage" });
    }

    const action = normalizeText(req.body?.action).toLowerCase();
    const remark = normalizeText(req.body?.remark);
    const now = new Date();
    const previousStage = complaint.status;

    if (!complaint.raisedAt || !complaint.deadlineAt) {
      const deadlineFields = buildComplaintDeadlineFields(complaint.raisedAt || complaint.createdAt || now);
      complaint.raisedAt = complaint.raisedAt || deadlineFields.raisedAt;
      complaint.deadlineAt = complaint.deadlineAt || deadlineFields.deadlineAt;
    }

    if (complaint.currentLevel === "department_head") {
      if (!["submit", "forward"].includes(action)) {
        return res.status(400).json({ message: "Select a valid complaint action" });
      }

      complaint.remarks.departmentHead = buildRemarkSnapshot({
        action,
        remark,
        user: req.user,
        actedAt: now,
      });
      complaint.timeline.push(
        buildTimelineEntry({
          level: "department_head",
          action,
          remark,
          user: req.user,
          actedAt: now,
        })
      );
      complaint.currentLevel = "site_head";
      complaint.status = "pending_site_head";
      complaint.lastMovedAt = now;
    } else if (complaint.currentLevel === "site_head") {
      if (!["submit", "forward"].includes(action)) {
        return res.status(400).json({ message: "Select a valid complaint action" });
      }

      complaint.remarks.siteHead = buildRemarkSnapshot({
        action,
        remark,
        user: req.user,
        actedAt: now,
      });
      complaint.timeline.push(
        buildTimelineEntry({
          level: "site_head",
          action,
          remark,
          user: req.user,
          actedAt: now,
        })
      );
      complaint.currentLevel = "main_admin";
      complaint.status = "pending_main_admin";
      complaint.lastMovedAt = now;
    } else if (complaint.currentLevel === "main_admin") {
      if (action !== "complete") {
        return res.status(400).json({ message: "Main admin can only complete the complaint" });
      }

      complaint.remarks.mainAdmin = buildRemarkSnapshot({
        action,
        remark,
        user: req.user,
        actedAt: now,
      });
      complaint.timeline.push(
        buildTimelineEntry({
          level: "main_admin",
          action,
          remark,
          user: req.user,
          actedAt: now,
        })
      );
      complaint.currentLevel = "completed";
      complaint.status = "completed";
      complaint.completedAt = now;
      complaint.lastMovedAt = now;
    } else {
      return res.status(400).json({ message: "This complaint is already completed" });
    }

    const deadlineState = getComplaintDeadlineState(complaint.toObject(), now);
    complaint.isOverdue = deadlineState.isOverdue;

    await complaint.save();

    await ComplaintNotification.updateMany(
      {
        complaint: complaint._id,
        stage: previousStage,
        readAt: null,
      },
      {
        $set: {
          readAt: now,
        },
      }
    );

    await markComplaintNotificationsReadForPrincipal({
      complaintId: complaint._id,
      principalType: req.user?.principalType === "employee" ? "employee" : "user",
      principalId: req.user?.id,
    });

    await createComplaintNotificationsForStage({
      complaint: complaint.toObject(),
      stage:
        complaint.status === "pending_site_head"
          ? "pending_site_head"
          : complaint.status === "pending_main_admin"
          ? "pending_main_admin"
          : "completed_employee",
    });

    return res.json({
      message:
        action === "complete"
          ? "Complaint marked as completed"
          : `Complaint ${action === "forward" ? "forwarded" : "submitted"} successfully`,
      complaint: mapComplaintDetail(complaint.toObject(), req.user),
    });
  } catch (err) {
    console.error("PROGRESS COMPLAINT ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to update complaint",
    });
  }
};

exports.getComplaintNotifications = async (req, res) => {
  try {
    const principalType = req.user?.principalType === "employee" ? "employee" : "user";
    const principalId = normalizeId(req.user?.id);
    const unreadFilter = {
      recipientPrincipalType: principalType,
      recipientPrincipalId: principalId,
      readAt: null,
    };

    const [rows, unreadCount] = await Promise.all([
      ComplaintNotification.find(unreadFilter).sort({ createdAt: -1 }).limit(10).lean(),
      ComplaintNotification.countDocuments(unreadFilter),
    ]);

    return res.json({
      counts: {
        unread: unreadCount,
      },
      rows: rows.map((row) => ({
        _id: normalizeId(row._id),
        complaintId: normalizeId(row.complaint),
        stage: normalizeText(row.stage),
        stageLabel:
          NOTIFICATION_STAGE_LABELS[row.stage] || normalizeText(row.stage),
        title: normalizeText(row.title),
        message: normalizeText(row.message),
        routePath: normalizeText(row.routePath),
        createdAt: row.createdAt || null,
      })),
    });
  } catch (err) {
    console.error("GET COMPLAINT NOTIFICATIONS ERROR:", err);
    return res.status(500).json({
      message: "Failed to load complaint notifications",
    });
  }
};

exports.markComplaintNotificationRead = async (req, res) => {
  try {
    const principalType = req.user?.principalType === "employee" ? "employee" : "user";
    const principalId = normalizeId(req.user?.id);

    const notification = await ComplaintNotification.findOne({
      _id: req.params.notificationId,
      recipientPrincipalType: principalType,
      recipientPrincipalId: principalId,
    });

    if (!notification) {
      return res.status(404).json({ message: "Complaint notification not found" });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.json({ message: "Complaint notification marked as read" });
  } catch (err) {
    console.error("MARK COMPLAINT NOTIFICATION READ ERROR:", err);
    return res.status(500).json({
      message: "Failed to update complaint notification",
    });
  }
};

exports.markAllComplaintNotificationsRead = async (req, res) => {
  try {
    const principalType = req.user?.principalType === "employee" ? "employee" : "user";
    const principalId = normalizeId(req.user?.id);

    const result = await ComplaintNotification.updateMany(
      {
        recipientPrincipalType: principalType,
        recipientPrincipalId: principalId,
        readAt: null,
      },
      {
        $set: {
          readAt: new Date(),
        },
      }
    );

    return res.json({
      message: "All complaint notifications marked as read",
      updatedCount: Number(result.modifiedCount || 0),
    });
  } catch (err) {
    console.error("MARK ALL COMPLAINT NOTIFICATIONS READ ERROR:", err);
    return res.status(500).json({
      message: "Failed to update complaint notifications",
    });
  }
};
