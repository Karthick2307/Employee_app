const router = require("express").Router();
const { auth, isAdmin } = require("../middleware/auth");
const upload = require("../middleware/checklistUpload");
const {
  createChecklist,
  decideChecklistTask,
  deleteChecklist,
  getApprovalTasks,
  getChecklistById,
  getChecklistTaskById,
  getChecklistTaskReport,
  getChecklists,
  getMyChecklistTasks,
  getNextChecklistNumber,
  runSchedulerManually,
  submitChecklistTask,
  toggleChecklistStatus,
  updateChecklist,
} = require("../controllers/checklist.controller");

router.get("/", auth, getChecklists);
router.get("/next-number", auth, getNextChecklistNumber);
router.get("/tasks/report", auth, isAdmin, getChecklistTaskReport);
router.get("/tasks/my", auth, getMyChecklistTasks);
router.get("/tasks/approvals", auth, getApprovalTasks);
router.get("/tasks/:id", auth, getChecklistTaskById);
router.post("/tasks/:id/submit", auth, upload.array("attachments", 10), submitChecklistTask);
router.post("/tasks/:id/decision", auth, decideChecklistTask);
router.post("/scheduler/run", auth, isAdmin, runSchedulerManually);
router.post("/", auth, isAdmin, createChecklist);
router.get("/:id", auth, getChecklistById);
router.put("/:id", auth, isAdmin, updateChecklist);
router.patch("/:id/status", auth, isAdmin, toggleChecklistStatus);
router.delete("/:id", auth, isAdmin, deleteChecklist);

module.exports = router;
