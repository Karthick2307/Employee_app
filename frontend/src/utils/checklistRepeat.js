const REPEAT_TYPE_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  custom: "Custom",
};

const CUSTOM_REPEAT_LABELS = {
  daily: { plural: "days", default: "Every day" },
  weekly: { plural: "weeks", default: "Every week" },
  monthly: { plural: "months", default: "Every month" },
  yearly: { plural: "years", default: "Every year" },
};

const MONTH_OF_YEAR_LABELS = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

const WEEK_DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const resolveRepeatType = (source) =>
  String(typeof source === "string" ? source : source?.repeatType || "")
    .trim()
    .toLowerCase();

const normalizeDayOfMonth = (value) => {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return null;
  }
  return day;
};

const extractDayOfMonthFromText = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const directDay = normalizeDayOfMonth(text);
  if (directDay) {
    return directDay;
  }

  const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoDateMatch) {
    return normalizeDayOfMonth(isoDateMatch[3]);
  }

  const repeatSummaryMatch =
    text.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i) ||
    text.match(/\b(\d{1,2})(?:st|nd|rd|th) of every month\b/i) ||
    text.match(
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)\b/i
    );

  return repeatSummaryMatch ? normalizeDayOfMonth(repeatSummaryMatch[1]) : null;
};

const resolveWeekDayLabel = (value) => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return (
    WEEK_DAY_LABELS.find((day) => day.toLowerCase() === normalizedValue) || ""
  );
};

const extractDayOfWeekFromText = (value) => {
  const directLabel = resolveWeekDayLabel(value);
  if (directLabel) {
    return directLabel;
  }

  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const summaryMatch = text.match(
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i
  );

  return resolveWeekDayLabel(summaryMatch?.[1] || "");
};

const ordinal = (value) => {
  const day = Number(value);
  if (Number.isNaN(day)) return value;
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
};

export const getChecklistRepeatMonthLabel = (value) => {
  const month = Number(value);
  return MONTH_OF_YEAR_LABELS[month] || "";
};

export const getChecklistRepeatDayOfMonthValue = (source = {}) => {
  if (typeof source !== "object" || source === null) {
    return extractDayOfMonthFromText(source);
  }

  return (
    extractDayOfMonthFromText(source.repeatDayOfMonth) ||
    extractDayOfMonthFromText(source.repeatSummary)
  );
};

export const getChecklistRepeatDayOfMonthDisplay = (source = {}) => {
  const day = getChecklistRepeatDayOfMonthValue(source);
  return day ? String(day) : "N/A";
};

export const getChecklistRepeatDayOfWeekValue = (source = {}) => {
  if (typeof source !== "object" || source === null) {
    return extractDayOfWeekFromText(source);
  }

  return (
    extractDayOfWeekFromText(source.repeatDayOfWeek) ||
    extractDayOfWeekFromText(source.repeatSummary)
  );
};

export const getChecklistRepeatDayOfWeekDisplay = (source = {}) => {
  return getChecklistRepeatDayOfWeekValue(source) || "N/A";
};

export const getCustomRepeatSummary = (source = {}) => {
  const unit = String(source.customRepeatUnit || "daily")
    .trim()
    .toLowerCase();
  const interval = Math.max(1, Number(source.customRepeatInterval || 1));
  const unitConfig = CUSTOM_REPEAT_LABELS[unit] || CUSTOM_REPEAT_LABELS.daily;
  const repeatDayOfWeek = String(source.repeatDayOfWeek || "").trim();
  const repeatDayOfMonth = Number(source.repeatDayOfMonth || 0);
  const repeatMonthLabel = getChecklistRepeatMonthLabel(source.repeatMonthOfYear);
  let baseSummary = "";

  if (interval === 1) {
    baseSummary = unitConfig.default;
  } else {
    baseSummary = `Every ${interval} ${unitConfig.plural}`;
  }

  if (unit === "weekly" && repeatDayOfWeek) {
    return `${baseSummary} on ${repeatDayOfWeek}`;
  }

  if (unit === "monthly" && repeatDayOfMonth >= 1) {
    return `${baseSummary} on the ${ordinal(repeatDayOfMonth)}`;
  }

  if (unit === "yearly" && repeatMonthLabel && repeatDayOfMonth >= 1) {
    return `${baseSummary} on ${repeatMonthLabel} ${ordinal(repeatDayOfMonth)}`;
  }

  if (unit === "yearly" && repeatMonthLabel) {
    return `${baseSummary} in ${repeatMonthLabel}`;
  }

  return baseSummary;
};

export const getChecklistRepeatTypeLabel = (source = {}) => {
  const repeatType = resolveRepeatType(source);
  return REPEAT_TYPE_LABELS[repeatType] || repeatType || "N/A";
};

export const getChecklistRepeatSummary = (source = {}) => {
  const repeatType = resolveRepeatType(source);
  const savedSummary = String(source.repeatSummary || "").trim();

  if (savedSummary) {
    return savedSummary;
  }

  if (repeatType === "custom") {
    return getCustomRepeatSummary(source);
  }

  if (repeatType === "weekly" && source.repeatDayOfWeek) {
    return `Every ${source.repeatDayOfWeek}`;
  }

  if (repeatType === "monthly" && source.repeatDayOfMonth) {
    return `${ordinal(source.repeatDayOfMonth)} of every month`;
  }

  if (repeatType === "yearly") {
    return "Every year";
  }

  if (repeatType === "daily") {
    return "Every day";
  }

  return "";
};

export const getChecklistRepeatDisplay = (source = {}) => {
  const repeatType = resolveRepeatType(source);
  const label = getChecklistRepeatTypeLabel(source);

  if (repeatType !== "custom") {
    return label;
  }

  const summary = getChecklistRepeatSummary(source);
  return summary ? `${label} (${summary})` : label;
};
