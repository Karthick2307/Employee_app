const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export const getChatLocationLabel = (value) =>
  String(value?.chatType || "").trim().toLowerCase() === "department"
    ? [
        value?.departmentDisplayName,
        value?.groupName,
        value?.departmentName,
      ]
        .map((item) => String(item || "").trim())
        .find(Boolean) || "Department Chat"
    : [
        value?.siteDisplayName,
        value?.groupName,
        value?.siteName,
        value?.companyName,
      ]
        .map((item) => String(item || "").trim())
        .find(Boolean) || "Site Chat";

export const getChatRoutePath = (value) =>
  String(value?.chatType || "").trim().toLowerCase() === "department"
    ? "/department-chat"
    : "/chat";

export const formatChatDateTime = (value) => {
  if (!value) return "-";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "-";

  return indiaDateTimeFormatter.format(parsedValue);
};

export const buildChatMentionNotificationBody = (notification) =>
  [
    getChatLocationLabel(notification),
    notification?.message ||
      (notification?.image?.url
        ? "Image shared"
        : notification?.attachment?.url
        ? "File shared"
        : ""),
  ]
    .filter(Boolean)
    .join(" | ");
