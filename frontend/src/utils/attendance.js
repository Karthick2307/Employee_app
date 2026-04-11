export const ATTENDANCE_STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "half_day", label: "Half Day" },
  { value: "leave", label: "Leave" },
  { value: "week_off", label: "Week Off" },
  { value: "holiday", label: "Holiday" },
  { value: "late", label: "Late" },
  { value: "on_duty", label: "On Duty / Field Work" },
  { value: "pending", label: "Pending" },
];

export const REGULARIZATION_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export const getAttendanceStatusLabel = (value) =>
  ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === value)?.label || "Unknown";

export const getRegularizationStatusLabel = (value) =>
  REGULARIZATION_STATUS_OPTIONS.find((option) => option.value === value)?.label || "Unknown";

export const getAttendanceStatusBadgeClass = (value, isLate = false) => {
  if (isLate || value === "late") return "bg-warning text-dark";
  if (value === "present") return "bg-success";
  if (value === "absent") return "bg-danger";
  if (value === "half_day") return "bg-info text-dark";
  if (value === "leave") return "bg-primary";
  if (value === "week_off" || value === "holiday") return "bg-secondary";
  if (value === "on_duty") return "bg-dark";
  return "bg-light text-dark border";
};

export const formatAttendanceDuration = (minutesValue) => {
  const minutes = Number(minutesValue || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h 0m";

  const hoursPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return `${hoursPart}h ${minutePart}m`;
};

export const formatAttendanceTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export const formatAttendanceDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getTodayDateInputValue = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentMonthValue = () => getTodayDateInputValue().slice(0, 7);

export const buildAttendanceQueryParams = (filters = {}) =>
  Object.entries(filters).reduce((result, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
