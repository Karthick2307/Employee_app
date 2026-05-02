const indiaTimeZone = "Asia/Kolkata";

const normalizeText = (value) => String(value || "").trim();

export const formatPollDate = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: indiaTimeZone,
  });
};

export const formatPollDateTime = (value) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: indiaTimeZone,
  });
};

export const formatPollScopeTypeLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const formatPollWindowStateLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "active":
      return "Active";
    case "upcoming":
      return "Upcoming";
    case "expired":
    case "closed":
      return "Expired";
    case "inactive":
      return "Inactive";
    default:
      return formatPollScopeTypeLabel(normalized);
  }
};

export const getPollWindowBadgeClass = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "active":
      return "bg-success-subtle text-success-emphasis border border-success-subtle";
    case "upcoming":
      return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
    case "expired":
    case "closed":
      return "bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";
    case "inactive":
    default:
      return "bg-light text-dark border";
  }
};

export const formatPollAssignmentStatusLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "submitted":
      return "Submitted";
    case "revoked":
      return "Revoked";
    case "not_answered":
    default:
      return "Not Answered";
  }
};

export const getPollAssignmentBadgeClass = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "submitted":
      return "bg-primary-subtle text-primary-emphasis border border-primary-subtle";
    case "revoked":
      return "bg-danger-subtle text-danger-emphasis border border-danger-subtle";
    case "not_answered":
    default:
      return "bg-light text-dark border";
  }
};

export const formatPollResponseTypeLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  switch (normalized) {
    case "multiple_choice":
      return "Multiple Choice";
    case "single_choice":
    default:
      return "Single Choice";
  }
};
