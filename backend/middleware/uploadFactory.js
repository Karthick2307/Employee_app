const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { env } = require("../config/env");
const { createHttpError } = require("../utils/httpError");

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

const normalizeText = (value) => String(value || "").trim().toLowerCase();
const safeBaseName = (value) =>
  String(value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "file";

const extensionMap = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "text/plain": ".txt",
};

const createDiskUpload = ({ allowedMimeTypes = [], maxFileSize = 10 * 1024 * 1024 } = {}) => {
  const allowList = new Set(allowedMimeTypes.map((item) => normalizeText(item)));

  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, env.uploadDir);
      },
      filename: (_req, file, cb) => {
        const mimeType = normalizeText(file?.mimetype);
        const extension =
          extensionMap[mimeType] || path.extname(String(file?.originalname || "")).toLowerCase();
        const fileName = `${Date.now()}-${crypto.randomUUID()}-${safeBaseName(
          file?.originalname
        )}${extension}`;

        cb(null, fileName);
      },
    }),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      const mimeType = normalizeText(file?.mimetype);
      if (!allowList.has(mimeType)) {
        cb(createHttpError("Unsupported attachment type", 400), false);
        return;
      }

      cb(null, true);
    },
  });
};

const createMemoryUpload = ({ allowedMimeTypes = [], maxFileSize = 5 * 1024 * 1024 } = {}) => {
  const allowList = new Set(allowedMimeTypes.map((item) => normalizeText(item)));

  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      const mimeType = normalizeText(file?.mimetype);
      if (!allowList.has(mimeType)) {
        cb(createHttpError("Unsupported attachment type", 400), false);
        return;
      }

      cb(null, true);
    },
  });
};

module.exports = {
  createDiskUpload,
  createMemoryUpload,
};
