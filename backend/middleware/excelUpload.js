const { createMemoryUpload } = require("./uploadFactory");

module.exports = createMemoryUpload({
  allowedMimeTypes: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  maxFileSize: 5 * 1024 * 1024,
});
