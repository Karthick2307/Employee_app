const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const {
  generatedChecklistTaskBulkDeleteSchema,
  idParamSchema,
} = require("../validators/checklist.validator");
const {
  bulkDeleteGeneratedChecklistTasks,
  deleteGeneratedChecklistTask,
  getGeneratedChecklistTasks,
} = require("../controllers/checklist.controller");

router.get(
  "/",
  auth,
  requirePermission("checklist_master", "view"),
  getGeneratedChecklistTasks
);

router.post(
  "/bulk-delete",
  auth,
  requirePermission("checklist_master", "delete"),
  validateRequest({ body: generatedChecklistTaskBulkDeleteSchema }),
  bulkDeleteGeneratedChecklistTasks
);

router.delete(
  "/:id",
  auth,
  requirePermission("checklist_master", "delete"),
  validateRequest({ params: idParamSchema }),
  deleteGeneratedChecklistTask
);

module.exports = router;
