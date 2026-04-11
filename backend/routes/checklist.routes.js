const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
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

router.get("/", auth, requirePermission("checklist_master", "view"), getChecklists);
router.get("/next-number", auth, requirePermission("checklist_master", "add"), getNextChecklistNumber);
router.get("/export/excel", auth, requirePermission("checklist_master", "export"), exportChecklistsExcel);
router.get("/admin-requests/notifications", auth, requirePermission("checklist_master", "view"), getChecklistRequestNotifications);
router.post(
  "/admin-requests/notifications/read-all",
  auth,
  requirePermission("checklist_master", "view"),
  markAllChecklistRequestNotificationsRead
);
router.post(
  "/admin-requests/notifications/:id/read",
  auth,
  requirePermission("checklist_master", "view"),
  markChecklistRequestNotificationRead
);
router.get(
  "/admin-requests",
  auth,
  requireAnyPermission([
    { moduleKey: "checklist_master", actionKey: "approve" },
    { moduleKey: "checklist_master", actionKey: "reject" },
  ]),
  getChecklistAdminRequests
);
router.get(
  "/admin-requests/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "checklist_master", actionKey: "approve" },
    { moduleKey: "checklist_master", actionKey: "reject" },
  ]),
  getChecklistAdminRequestById
);
router.post("/admin-requests/:id/approve", auth, requirePermission("checklist_master", "approve"), approveChecklistAdminRequest);
router.post("/admin-requests/:id/reject", auth, requirePermission("checklist_master", "reject"), rejectChecklistAdminRequest);
router.get("/transfers/checklists", auth, requirePermission("checklist_transfer", "view"), getChecklistTransferChecklists);
router.get("/transfers/history", auth, requirePermission("checklist_transfer", "view"), getChecklistTransferHistory);
router.get("/tasks/report/export/excel", auth, requirePermission("reports", "export"), exportChecklistTaskReportExcel);
router.get("/tasks/report/export/pdf", auth, requirePermission("reports", "export"), exportChecklistTaskReportPdf);
router.get("/tasks/report", auth, requirePermission("reports", "report_view"), getChecklistTaskReport);
router.get("/tasks/my", auth, requirePermission("assigned_checklists", "view"), getMyChecklistTasks);
router.get("/tasks/approvals", auth, requirePermission("approval_inbox", "view"), getApprovalTasks);
router.get(
  "/tasks/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "assigned_checklists", actionKey: "view" },
    { moduleKey: "approval_inbox", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
    { moduleKey: "checklist_master", actionKey: "view" },
  ]),
  getChecklistTaskById
);
router.post(
  "/tasks/:id/submit",
  auth,
  requirePermission("assigned_checklists", "edit"),
  upload.array("attachments", 10),
  submitChecklistTask
);
router.post("/tasks/:id/decision", auth, requirePermission("approval_inbox", "approve"), decideChecklistTask);
router.post("/transfers/permanent", auth, requirePermission("checklist_transfer", "transfer"), createPermanentChecklistTransfer);
router.post("/transfers/temporary", auth, requirePermission("checklist_transfer", "transfer"), createTemporaryChecklistTransfer);
router.post("/import/excel", auth, requirePermission("checklist_master", "add"), excelUpload.single("file"), importChecklistsExcel);
router.post("/bulk-delete", auth, requirePermission("checklist_master", "delete"), bulkDeleteChecklists);
router.post("/scheduler/run", auth, requirePermission("checklist_master", "status_update"), runSchedulerManually);
router.post("/", auth, requirePermission("checklist_master", "add"), createChecklist);
router.get("/:id", auth, requirePermission("checklist_master", "view"), getChecklistById);
router.put("/:id", auth, requirePermission("checklist_master", "edit"), updateChecklist);
router.patch("/:id/status", auth, requirePermission("checklist_master", "status_update"), toggleChecklistStatus);
router.delete("/:id", auth, requirePermission("checklist_master", "delete"), deleteChecklist);

module.exports = router;
