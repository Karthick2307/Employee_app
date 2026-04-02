const multer = require("multer");
const path = require("path");

const allowedExtensions = new Set([".xlsx"]);

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(String(file?.originalname || "")).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      cb(null, false);
      return;
    }

    cb(null, true);
  },
});
