const { createDiskUpload } = require("./uploadFactory");

module.exports = createDiskUpload({
  allowedMimeTypes: ["image/jpeg", "image/png"],
  maxFileSize: 5 * 1024 * 1024,
});
