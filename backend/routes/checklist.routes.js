const router = require("express").Router();
const { auth, isAdmin } = require("../middleware/auth");
const upload = require("../middleware/checklistUpload");
const excelUpload = require("../middleware/excelUpload");
const {
  approveChecklistAdminRequest,
  bulkDeleteChecklists,
  createChecklist,
  createPermanentChecklistTransfer,
  createTemporaryChecklistTransfer,
  decideChecklistTask,
  deleteChecklist,
  exportChecklistTaskReportExcel,
  exportChecklistTaskReportPdf,
  exportChecklistsExcel,
  getChecklistAdminRequestById,
  getChecklistAdminRequests,
  getApprovalTasks,
  getChecklistById,
  getChecklistRequestNotifications,
  getChecklistTransferChecklists,
  getChecklistTransferHistory,
  getChecklistTaskById,
  getChecklistTaskReport,
  getChecklists,
  getMyChecklistTasks,
  getNextChecklistNumber,
  markAllChecklistRequestNotificationsRead,
  markChecklistRequestNotificationRead,
  rejectChecklistAdminRequest,
  importChecklistsExcel,
  runSchedulerManually,
  submitChecklistTask,
  toggleChecklistStatus,
  updateChecklist,
} = require("../controllers/checklist.controller");

router.get("/", auth, getChecklists);
router.get("/next-number", auth, getNextChecklistNumber);
router.get("/export/excel", auth, exportChecklistsExcel);
router.get("/admin-requests/notifications", auth, getChecklistRequestNotifications);
router.post(
  "/admin-requests/notifications/read-all",
  auth,
  markAllChecklistRequestNotificationsRead
);
router.post(
  "/admin-requests/notifications/:id/read",
  auth,
  markChecklistRequestNotificationRead
);
router.get("/admin-requests", auth, getChecklistAdminRequests);
router.get("/admin-requests/:id", auth, getChecklistAdminRequestById);
router.post("/admin-requests/:id/approve", auth, isAdmin, approveChecklistAdminRequest);
router.post("/admin-requests/:id/reject", auth, isAdmin, rejectChecklistAdminRequest);
router.get("/transfers/checklists", auth, getChecklistTransferChecklists);
router.get("/transfers/history", auth, getChecklistTransferHistory);
router.get("/tasks/report/export/excel", auth, isAdmin, exportChecklistTaskReportExcel);
router.get("/tasks/report/export/pdf", auth, isAdmin, exportChecklistTaskReportPdf);
router.get("/tasks/report", auth, isAdmin, getChecklistTaskReport);
router.get("/tasks/my", auth, getMyChecklistTasks);
router.get("/tasks/approvals", auth, getApprovalTasks);
router.get("/tasks/:id", auth, getChecklistTaskById);
router.post("/tasks/:id/submit", auth, upload.array("attachments", 10), submitChecklistTask);
router.post("/tasks/:id/decision", auth, decideChecklistTask);
router.post("/transfers/permanent", auth, createPermanentChecklistTransfer);
router.post("/transfers/temporary", auth, createTemporaryChecklistTransfer);
router.post("/import/excel", auth, excelUpload.single("file"), importChecklistsExcel);
router.post("/bulk-delete", auth, bulkDeleteChecklists);
router.post("/scheduler/run", auth, isAdmin, runSchedulerManually);
router.post("/", auth, createChecklist);
router.get("/:id", auth, getChecklistById);
router.put("/:id", auth, updateChecklist);
router.patch("/:id/status", auth, isAdmin, toggleChecklistStatus);
router.delete("/:id", auth, deleteChecklist);

module.exports = router;
