const Complaint = require("../models/Complaint");
const ComplaintNotification = require("../models/ComplaintNotification");

const GLOBAL_COMPLAINT_WINDOW_MS = 24 * 60 * 60 * 1000;
const COMPLAINT_DUE_SOON_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const COMPLAINT_REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const COMPLAINT_SCHEDULER_INTERVAL_MS = 60 * 1000;
const MAIN_ADMIN_REMINDER_STAGE = "main_admin_reminder";

let schedulerTimer = null;
let schedulerInFlight = false;

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

const toValidDate = (value) => {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildComplaintDeadlineFields = (raisedAt = new Date()) => {
  const resolvedRaisedAt = toValidDate(raisedAt) || new Date();

  return {
    raisedAt: resolvedRaisedAt,
    deadlineAt: new Date(resolvedRaisedAt.getTime() + GLOBAL_COMPLAINT_WINDOW_MS),
    isOverdue: false,
    reminderLastSentAt: null,
    reminderCount: 0,
  };
};

const isComplaintCompleted = (complaint = {}) => {
  const status = normalizeText(complaint?.status).toLowerCase();
  const currentLevel = normalizeText(complaint?.currentLevel).toLowerCase();

  return status === "completed" || status === "closed" || currentLevel === "completed";
};

const getComplaintDeadlineState = (complaint = {}, now = new Date()) => {
  const nowDate = toValidDate(now) || new Date();
  const raisedAt =
    toValidDate(complaint?.raisedAt) ||
    toValidDate(complaint?.createdAt) ||
    nowDate;
  const deadlineAt =
    toValidDate(complaint?.deadlineAt) ||
    new Date(raisedAt.getTime() + GLOBAL_COMPLAINT_WINDOW_MS);
  const completedAt = toValidDate(complaint?.completedAt);
  const completed = isComplaintCompleted(complaint) || Boolean(completedAt);
  const referenceEndAt = completed && completedAt ? completedAt : nowDate;
  const elapsedMs = Math.max(0, referenceEndAt.getTime() - raisedAt.getTime());
  const overdueMs = Math.max(0, referenceEndAt.getTime() - deadlineAt.getTime());
  const remainingMs =
    !completed && nowDate.getTime() < deadlineAt.getTime()
      ? deadlineAt.getTime() - nowDate.getTime()
      : 0;
  const isOverdue = Boolean(complaint?.isOverdue) || overdueMs > 0;
  const isDueSoon =
    !completed &&
    !isOverdue &&
    remainingMs > 0 &&
    remainingMs <= COMPLAINT_DUE_SOON_THRESHOLD_MS;

  let statusCode = "in_progress";
  let statusLabel = "In Progress";

  if (completed) {
    statusCode = "completed";
    statusLabel = "Resolved / Completed";
  } else if (isOverdue) {
    statusCode = "overdue";
    statusLabel = "Overdue";
  } else if (isDueSoon) {
    statusCode = "due_soon";
    statusLabel = "Due Soon";
  }

  return {
    raisedAt,
    deadlineAt,
    completedAt,
    completed,
    elapsedMs,
    overdueMs,
    remainingMs,
    isOverdue,
    isDueSoon,
    statusCode,
    statusLabel,
  };
};

const formatDurationLabel = (durationMs) => {
  const safeDurationMs = Math.max(0, Number(durationMs || 0));
  const totalSeconds = Math.floor(safeDurationMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || (!days && !hours && seconds)) {
    parts.push(`${seconds}s`);
  }

  return parts.slice(0, 3).join(" ");
};

const formatDateTime = (value) => {
  const parsed = toValidDate(value);
  if (!parsed) return "-";

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const getPendingLevelLabel = (complaint = {}) => {
  const currentLevel = normalizeText(complaint?.currentLevel).toLowerCase();

  if (currentLevel === "department_head") return "Department Head";
  if (currentLevel === "site_head") return "Site Head";
  if (currentLevel === "main_admin") return "Main Admin";
  if (currentLevel === "completed") return "Completed";
  return "Pending";
};

const buildReminderNotificationContent = (complaint = {}, now = new Date()) => {
  const deadlineState = getComplaintDeadlineState(complaint, now);
  const complaintCode = normalizeText(complaint?.complaintCode) || "Complaint";
  const employeeName = normalizeText(complaint?.employeeName) || "Employee";
  const siteDisplayName = normalizeText(complaint?.siteDisplayName) || "-";
  const departmentName = normalizeText(complaint?.departmentName) || "-";
  const pendingLevelLabel = getPendingLevelLabel(complaint);
  const elapsedLabel = formatDurationLabel(deadlineState.elapsedMs);
  const overdueLabel = deadlineState.isOverdue
    ? ` | Overdue by ${formatDurationLabel(deadlineState.overdueMs)}`
    : "";

  return {
    title: `${complaintCode} pending with ${pendingLevelLabel}`,
    message: [
      `Complaint ID: ${complaintCode}`,
      `Employee Name: ${employeeName}`,
      `Site: ${siteDisplayName}`,
      `Department: ${departmentName}`,
      `Raised Time: ${formatDateTime(deadlineState.raisedAt)}`,
      `Current Pending Level: ${pendingLevelLabel}`,
      `Time elapsed: ${elapsedLabel}${overdueLabel}`,
    ].join(" | "),
  };
};

const buildNotificationRoutePath = (complaintId) =>
  `/complaints/reports?complaintId=${normalizeId(complaintId)}`;

const createMainAdminReminderNotifications = async (complaint, now = new Date()) => {
  const complaintId = normalizeId(complaint?._id);
  const recipientIds = uniqueIdList(complaint?.routing?.mainAdminPrincipalIds);

  if (!complaintId || !recipientIds.length) {
    return 0;
  }

  const { title, message } = buildReminderNotificationContent(complaint, now);
  const routePath = buildNotificationRoutePath(complaintId);

  await ComplaintNotification.insertMany(
    recipientIds.map((recipientPrincipalId) => ({
      complaint: complaintId,
      recipientPrincipalType: "user",
      recipientPrincipalId,
      stage: MAIN_ADMIN_REMINDER_STAGE,
      title,
      message,
      routePath,
    }))
  );

  return recipientIds.length;
};

const runComplaintScheduler = async () => {
  if (schedulerInFlight) {
    return {
      processed: 0,
      remindersSent: 0,
      skipped: true,
      overdueUpdated: 0,
    };
  }

  schedulerInFlight = true;

  try {
    const now = new Date();
    const complaints = await Complaint.find({
      status: { $ne: "completed" },
    });

    let remindersSent = 0;
    let overdueUpdated = 0;

    for (const complaint of complaints) {
      const baseFields = buildComplaintDeadlineFields(complaint.raisedAt || complaint.createdAt || now);
      let hasChanges = false;

      if (!complaint.raisedAt) {
        complaint.raisedAt = baseFields.raisedAt;
        hasChanges = true;
      }

      if (!complaint.deadlineAt) {
        complaint.deadlineAt = baseFields.deadlineAt;
        hasChanges = true;
      }

      const deadlineState = getComplaintDeadlineState(complaint.toObject(), now);
      const wasOverdue = Boolean(complaint.isOverdue);
      complaint.isOverdue = deadlineState.isOverdue;

      if (!wasOverdue && deadlineState.isOverdue) {
        overdueUpdated += 1;
        hasChanges = true;
      }

      if (wasOverdue !== deadlineState.isOverdue) {
        hasChanges = true;
      }

      if (deadlineState.completed) {
        if (hasChanges) {
          await complaint.save();
        }
        continue;
      }

      const reminderBaseTime = toValidDate(complaint.reminderLastSentAt)
        ? new Date(complaint.reminderLastSentAt)
        : complaint.raisedAt;
      const nextReminderAt = new Date(
        reminderBaseTime.getTime() + COMPLAINT_REMINDER_INTERVAL_MS
      );

      if (now.getTime() >= nextReminderAt.getTime()) {
        await createMainAdminReminderNotifications(complaint.toObject(), now);
        complaint.reminderLastSentAt = now;
        complaint.reminderCount = Number(complaint.reminderCount || 0) + 1;
        remindersSent += 1;
        hasChanges = true;
      }

      if (hasChanges) {
        await complaint.save();
      }
    }

    return {
      processed: complaints.length,
      remindersSent,
      skipped: false,
      overdueUpdated,
    };
  } finally {
    schedulerInFlight = false;
  }
};

const startComplaintScheduler = () => {
  if (schedulerTimer) return;

  void runComplaintScheduler();

  schedulerTimer = setInterval(() => {
    void runComplaintScheduler();
  }, COMPLAINT_SCHEDULER_INTERVAL_MS);
};

const stopComplaintScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

module.exports = {
  COMPLAINT_DUE_SOON_THRESHOLD_MS,
  COMPLAINT_REMINDER_INTERVAL_MS,
  GLOBAL_COMPLAINT_WINDOW_MS,
  MAIN_ADMIN_REMINDER_STAGE,
  buildComplaintDeadlineFields,
  buildReminderNotificationContent,
  createMainAdminReminderNotifications,
  formatDurationLabel,
  getComplaintDeadlineState,
  runComplaintScheduler,
  startComplaintScheduler,
  stopComplaintScheduler,
};
