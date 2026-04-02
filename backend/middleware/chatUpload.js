const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const blockedExtensions = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".cjs",
  ".svg",
  ".xml",
  ".exe",
  ".msi",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".php",
  ".py",
  ".jar",
]);

const blockedMimeTypes = new Set([
  "text/html",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-bat",
  "application/x-sh",
  "application/x-powershell",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const extension = String(path.extname(file.originalname || "") || "").toLowerCase();
  const mimeType = String(file.mimetype || "").trim().toLowerCase();

  if (blockedExtensions.has(extension) || blockedMimeTypes.has(mimeType)) {
    cb(new Error("This file type is not allowed in chat"), false);
    return;
  }

  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});
