const MB = 1024 * 1024;

export const IMAGE_FILE_ACCEPT = "image/png,image/jpeg,image/jpg";
export const GENERAL_ATTACHMENT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "text/plain",
  ".aac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
  ".webm",
  ".csv",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
].join(",");
export const EXCEL_IMPORT_ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const IMAGE_FILE_OPTIONS = {
  label: "Image",
  maxSizeBytes: 5 * MB,
  allowedTypes: ["image/png", "image/jpeg", "image/jpg"],
  allowedExtensions: [".png", ".jpg", ".jpeg"],
};

export const GENERAL_ATTACHMENT_OPTIONS = {
  label: "Attachment",
  maxSizeBytes: 10 * MB,
  allowedTypes: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "application/pdf",
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  allowedExtensions: [
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
    ".aac",
    ".m4a",
    ".mp3",
    ".ogg",
    ".wav",
    ".webm",
    ".txt",
    ".csv",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
  ],
};

export const EXCEL_IMPORT_OPTIONS = {
  label: "Excel import file",
  maxSizeBytes: 10 * MB,
  allowedTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  allowedExtensions: [".xlsx"],
};

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  return `${(bytes / MB).toFixed(bytes >= MB ? 1 : 2)} MB`;
};

const getFileExtension = (fileName) => {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const dotIndex = normalizedName.lastIndexOf(".");
  return dotIndex >= 0 ? normalizedName.slice(dotIndex) : "";
};

const matchesAllowedType = (file, allowedTypes = [], allowedExtensions = []) => {
  if (!allowedTypes.length && !allowedExtensions.length) return true;

  const fileType = String(file?.type || "").trim().toLowerCase();
  const fileExtension = getFileExtension(file?.name);

  return (
    (fileType && allowedTypes.map((item) => item.toLowerCase()).includes(fileType)) ||
    (fileExtension &&
      allowedExtensions.map((item) => item.toLowerCase()).includes(fileExtension))
  );
};

export const validateFile = (file, options = {}) => {
  if (!file) return "";

  const label = options.label || "File";
  const maxSizeBytes = Number(options.maxSizeBytes || 0);
  const allowedExtensions = Array.isArray(options.allowedExtensions)
    ? options.allowedExtensions
    : [];
  const allowedTypes = Array.isArray(options.allowedTypes) ? options.allowedTypes : [];

  if (maxSizeBytes > 0 && Number(file.size || 0) > maxSizeBytes) {
    return `${label} must be ${formatBytes(maxSizeBytes)} or smaller.`;
  }

  if (!matchesAllowedType(file, allowedTypes, allowedExtensions)) {
    const allowedText = allowedExtensions.length ? allowedExtensions.join(", ") : "supported";
    return `${label} type is not supported. Allowed: ${allowedText}.`;
  }

  return "";
};

export const validateFiles = (files, options = {}) => {
  const fileList = Array.from(files || []);

  for (const file of fileList) {
    const message = validateFile(file, options);
    if (message) return message;
  }

  return "";
};
