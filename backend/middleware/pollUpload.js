const { createDiskUpload } = require("./uploadFactory");

module.exports = createDiskUpload({
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  maxFileSize: 10 * 1024 * 1024,
});
