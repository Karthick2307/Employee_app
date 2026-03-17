import { getCustomRepeatSummary } from "./checklistRepeat";

const indiaTimeZone = "Asia/Kolkata";
const normalizePriority = (value) =>
  String(
    typeof value === "string" ? value : value?.priority || value?.checklist?.priority || ""
  )
    .trim()
    .toLowerCase();

export const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: indiaTimeZone,
  });
};

export const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: indiaTimeZone,
  });
};

export const formatTimeLabel = (value) => {
  if (!value) return "-";

  const [hoursText = "00", minutesText = "00"] = String(value).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

export const formatScheduleLabel = (value) => {
  const scheduleTypeSource =
    typeof value === "string" ? value : value?.scheduleType || value?.repeatType || "";
  const normalized = String(scheduleTypeSource || "").trim().toLowerCase();
  if (!normalized) return "-";

  if (normalized === "custom") {
    const summary =
      String(value?.repeatSummary || "").trim() ||
      getCustomRepeatSummary(value || {});
    return summary ? `Custom (${summary})` : "Custom";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const formatEmployeeLabel = (employee) =>
  [employee?.employeeCode, employee?.employeeName].filter(Boolean).join(" - ") || "-";

export const getCurrentApprover = (task) => {
  if (task?.currentApprovalEmployee) {
    return task.currentApprovalEmployee;
  }

  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];

  const pendingStep = approvalSteps.find((step) => step?.status === "pending");
  if (pendingStep?.approverEmployee) {
    return pendingStep.approverEmployee;
  }

  const waitingStep = approvalSteps.find((step) => step?.status === "waiting");
  if (waitingStep?.approverEmployee) {
    return waitingStep.approverEmployee;
  }

  const lastActionedStep = [...approvalSteps]
    .filter((step) => step?.status && step.status !== "waiting")
    .sort((left, right) => (Number(left?.approvalLevel) || 0) - (Number(right?.approvalLevel) || 0))
    .at(-1);

  return lastActionedStep?.approverEmployee || null;
};

export const formatCurrentApproverLabel = (task) =>
  formatEmployeeLabel(getCurrentApprover(task));

export const getApprovalWorkflowEmployees = (task) => {
  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const seen = new Set();

  return approvalSteps
    .map((step) => step?.approverEmployee)
    .filter((employee) => {
      const employeeId = String(employee?._id || employee || "").trim();
      if (!employeeId || seen.has(employeeId)) return false;
      seen.add(employeeId);
      return true;
    });
};

export const formatApprovalWorkflowLabel = (task) => {
  const labels = getApprovalWorkflowEmployees(task)
    .map((employee) => formatEmployeeLabel(employee))
    .filter((label) => label && label !== "-");

  return labels.join(", ") || "-";
};

export const formatApprovalLabel = (checklist) => {
  const approvals = Array.isArray(checklist?.approvals) ? checklist.approvals : [];

  if (!approvals.length) return "Not mapped";

  return approvals
    .map((row) => formatEmployeeLabel(row?.approvalEmployee))
    .filter(Boolean)
    .join(", ");
};

export const formatPriorityLabel = (value) => {
  const normalized = normalizePriority(value);
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getPriorityBadgeClass = (value) => {
  switch (normalizePriority(value)) {
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-warning text-dark";
    case "low":
      return "bg-success";
    default:
      return "bg-secondary";
  }
};

export const getPriorityRowClass = (value) => {
  switch (normalizePriority(value)) {
    case "high":
      return "table-danger";
    case "medium":
      return "table-warning";
    case "low":
      return "table-success";
    default:
      return "";
  }
};

export const getTaskStatusBadgeClass = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "approved":
      return "bg-success";
    case "rejected":
      return "bg-danger";
    case "submitted":
      return "bg-warning text-dark";
    case "open":
    default:
      return "bg-primary";
  }
};

export const formatTaskStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const formatTimelinessLabel = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "advanced":
      return "Advanced";
    case "on_time":
      return "On Time";
    case "delay":
      return "Delay";
    case "pending":
    default:
      return "Pending";
  }
};

export const getTimelinessBadgeClass = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "advanced":
      return "bg-info text-dark";
    case "on_time":
      return "bg-success";
    case "delay":
      return "bg-danger";
    case "pending":
    default:
      return "bg-secondary";
  }
};
