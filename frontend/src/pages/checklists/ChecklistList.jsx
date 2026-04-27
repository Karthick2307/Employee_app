import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import {
  formatApprovalLabel,
  formatApprovalTypeLabel,
  formatChecklistDependencyLabel,
  formatChecklistDependencyStatus,
  formatChecklistTaskStatus,
  formatChecklistScoreLabel,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  formatTargetDayCountLabel,
  getApprovalTypeBadgeClass,
  getChecklistDependencyStatusBadgeClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getChecklistTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

const getChecklistSiteName = (site) => String(site?.name || "").trim();

function ViewIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.087.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M12.854.146a.5.5 0 0 1 .707 0l2.586 2.586a.5.5 0 0 1 0 .707l-10 10L3 14l.561-3.146zM11.207 2L4 9.207V12h2.793L14 4.793z" />
      <path
        fillRule="evenodd"
        d="M1 13.5V16h2.5l7.373-7.373l-2.5-2.5zM15 3.793L12.207 1L13.5-.293a1 1 0 0 1 1.414 0l1.379 1.379a1 1 0 0 1 0 1.414z"
      />
    </svg>
  );
}

function ToggleIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {active ? (
        <>
          <path d="M11 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 4a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      ) : (
        <>
          <path d="M5 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 8a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      )}
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0A.5.5 0 0 1 8.5 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2H5V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2.5a1 1 0 0 1 1 1M6 1v1h4V1z" />
    </svg>
  );
}

export default function ChecklistList() {
  const { can } = usePermissions();
  const canManageChecklistMasters = can("checklist_master", "view");
  const canCreateChecklistMaster = can("checklist_master", "add");
  const canEditChecklistMaster = can("checklist_master", "edit");
  const canDeleteChecklistMaster = can("checklist_master", "delete");
  const canStatusUpdateChecklistMaster = can("checklist_master", "status_update");
  const canExportChecklistMaster = can("checklist_master", "export");
  const canViewOwnTasks = can("own_task", "view");
  const canViewApprovalInbox = can("approval_inbox", "view");

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const importInputRef = useRef(null);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        const response = await api.get(
          canManageChecklistMasters ? "/checklists" : "/checklists/tasks/my",
          {
            params: {
              search: search || undefined,
              status: status || undefined,
              scheduleType: scheduleType || undefined,
            },
          }
        );

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist list load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [canManageChecklistMasters, reloadToken, scheduleType, search, status]);

  useEffect(() => {
    if (!canManageChecklistMasters) {
      setSelectedChecklistIds([]);
      return;
    }

    setSelectedChecklistIds((currentValue) =>
      currentValue.filter((selectedId) =>
        rows.some((row) => String(row._id) === String(selectedId))
      )
    );
  }, [canManageChecklistMasters, rows]);

  const removeRowsFromState = (checklistIds) => {
    const normalizedIds = checklistIds.map((id) => String(id));

    setRows((currentValue) =>
      currentValue.filter((row) => !normalizedIds.includes(String(row._id)))
    );
    setSelectedChecklistIds((currentValue) =>
      currentValue.filter((selectedId) => !normalizedIds.includes(String(selectedId)))
    );
  };

  const toggleChecklistSelection = (id) => {
    const normalizedId = String(id);

    setSelectedChecklistIds((currentValue) =>
      currentValue.includes(normalizedId)
        ? currentValue.filter((selectedId) => selectedId !== normalizedId)
        : [...currentValue, normalizedId]
    );
  };

  const toggleAllChecklistSelections = () => {
    const visibleChecklistIds = rows.map((row) => String(row._id));

    if (
      visibleChecklistIds.length &&
      visibleChecklistIds.every((checklistId) => selectedChecklistIds.includes(checklistId))
    ) {
      setSelectedChecklistIds([]);
      return;
    }

    setSelectedChecklistIds(visibleChecklistIds);
  };

  const toggleChecklistStatus = async (id) => {
    try {
      await api.patch(`/checklists/${id}/status`);
      setRows((prev) =>
        prev.map((row) =>
          row._id === id ? { ...row, status: !row.status } : row
        )
      );
    } catch (err) {
      console.error("Checklist status toggle failed:", err);
      alert(err.response?.data?.message || "Failed to update checklist status");
    }
  };

  const deleteChecklist = async (id) => {
    if (!window.confirm("Delete this checklist master and its generated tasks?")) {
      return;
    }

    try {
      await api.delete(`/checklists/${id}`);
      removeRowsFromState([id]);
    } catch (err) {
      console.error("Checklist delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete checklist master");
    }
  };

  const deleteSelectedChecklists = async () => {
    if (!selectedChecklistIds.length) {
      return;
    }

    const checklistIdsToDelete = [...selectedChecklistIds];

    if (
      !window.confirm(
        `Delete ${checklistIdsToDelete.length} selected checklist master${
          checklistIdsToDelete.length === 1 ? "" : "s"
        } and their generated tasks?`
      )
    ) {
      return;
    }

    setBulkDeleteLoading(true);

    try {
      const response = await api.post("/checklists/bulk-delete", {
        checklistIds: checklistIdsToDelete,
      });
      const deletedCount = Number(response.data?.deletedCount || checklistIdsToDelete.length);

      removeRowsFromState(checklistIdsToDelete);
      alert(
        `${deletedCount} checklist master${
          deletedCount === 1 ? "" : "s"
        } deleted successfully.`
      );
    } catch (err) {
      console.error("Checklist bulk delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete selected checklist masters");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const runScheduler = async () => {
    setSchedulerLoading(true);

    try {
      const response = await api.post("/checklists/scheduler/run");
      const created = Number(response.data?.created || 0);
      alert(`Scheduler completed. ${created} task${created === 1 ? "" : "s"} created.`);
    } catch (err) {
      console.error("Checklist scheduler run failed:", err);
      alert(err.response?.data?.message || "Failed to run checklist scheduler");
    } finally {
      setSchedulerLoading(false);
    }
  };

  const exportChecklistExcel = async () => {
    setExportLoading(true);

    try {
      const response = await api.get("/checklists/export/excel", {
        params: {
          search: search || undefined,
          status: status || undefined,
          scheduleType: scheduleType || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "checklist-masters.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Checklist export failed:", err);
      alert(err.response?.data?.message || "Failed to export checklist masters");
    } finally {
      setExportLoading(false);
    }
  };

  const openChecklistImportPicker = () => {
    if (importLoading) return;
    importInputRef.current?.click();
  };

  const importChecklistExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setImportLoading(true);

    try {
      const response = await api.post("/checklists/import/excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const createdCount = Number(response.data?.createdCount || 0);
      const failedCount = Number(response.data?.failedCount || 0);
      const failures = Array.isArray(response.data?.failures) ? response.data.failures : [];
      const previewFailures = failures
        .slice(0, 5)
        .map((failure) => `Row ${failure.rowNumber}: ${failure.message}`)
        .join("\n");

      alert(
        [
          `Import completed.`,
          `${createdCount} checklist master${createdCount === 1 ? "" : "s"} created.`,
          `${failedCount} row${failedCount === 1 ? "" : "s"} failed.`,
          previewFailures ? `\n${previewFailures}` : "",
        ].join("\n")
      );

      setReloadToken((currentValue) => currentValue + 1);
    } catch (err) {
      console.error("Checklist import failed:", err);
      alert(err.response?.data?.message || "Failed to import checklist masters");
    } finally {
      setImportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setScheduleType("");
  };

  return canManageChecklistMasters ? (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx"
        className="d-none"
        onChange={importChecklistExcel}
      />
      <AdminChecklistMasterList
        rows={rows}
        loading={loading}
        search={search}
        status={status}
        scheduleType={scheduleType}
        setSearch={setSearch}
        setStatus={setStatus}
        setScheduleType={setScheduleType}
        toggleChecklistStatus={toggleChecklistStatus}
        deleteChecklist={deleteChecklist}
        selectedChecklistIds={selectedChecklistIds}
        toggleChecklistSelection={toggleChecklistSelection}
        toggleAllChecklistSelections={toggleAllChecklistSelections}
        deleteSelectedChecklists={deleteSelectedChecklists}
        bulkDeleteLoading={bulkDeleteLoading}
        runScheduler={runScheduler}
        schedulerLoading={schedulerLoading}
        clearFilters={clearFilters}
        exportChecklistExcel={exportChecklistExcel}
        exportLoading={exportLoading}
        openChecklistImportPicker={openChecklistImportPicker}
        importLoading={importLoading}
        canDelete={canDeleteChecklistMaster}
        canCreate={canCreateChecklistMaster}
        canEdit={canEditChecklistMaster}
        canToggle={canStatusUpdateChecklistMaster}
        canRunScheduler={canStatusUpdateChecklistMaster}
        canExport={canExportChecklistMaster}
        canImport={canCreateChecklistMaster}
      />
    </>
  ) : (
    <EmployeeChecklistTaskList
      rows={rows}
      loading={loading}
      search={search}
      status={status}
      scheduleType={scheduleType}
      setSearch={setSearch}
      setStatus={setStatus}
      setScheduleType={setScheduleType}
      clearFilters={clearFilters}
      canViewOwnTasks={canViewOwnTasks}
      canViewApprovalInbox={canViewApprovalInbox}
    />
  );
}

function AdminChecklistMasterList({
  rows,
  loading,
  search,
  status,
  scheduleType,
  setSearch,
  setStatus,
  setScheduleType,
  toggleChecklistStatus,
  deleteChecklist,
  selectedChecklistIds,
  toggleChecklistSelection,
  toggleAllChecklistSelections,
  deleteSelectedChecklists,
  bulkDeleteLoading,
  runScheduler,
  schedulerLoading,
  clearFilters,
  exportChecklistExcel,
  exportLoading,
  openChecklistImportPicker,
  importLoading,
  canExport,
  canImport,
  canDelete,
  canCreate,
  canEdit,
  canToggle,
  canRunScheduler,
}) {
  const allRowsSelected =
    rows.length > 0 &&
    rows.every((row) => selectedChecklistIds.includes(String(row._id)));
  const activeCount = rows.filter((row) => row.status).length;
  const inactiveCount = rows.length - activeCount;
  const hasFilters = Boolean(search.trim() || status || scheduleType);

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">Checklist Master</h3>
            <div className="page-subtitle">
              Create recurring checklist definitions and auto-generate employee tasks.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canDelete ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={deleteSelectedChecklists}
                disabled={!selectedChecklistIds.length || bulkDeleteLoading}
              >
                {bulkDeleteLoading
                  ? "Deleting..."
                  : `Delete Selected${selectedChecklistIds.length ? ` (${selectedChecklistIds.length})` : ""}`}
              </button>
            ) : null}
            {canExport ? (
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={exportChecklistExcel}
                disabled={exportLoading}
              >
                {exportLoading ? "Exporting..." : "Export Excel"}
              </button>
            ) : null}
            {canImport ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={openChecklistImportPicker}
                disabled={importLoading}
              >
                {importLoading ? "Importing..." : "Import Excel"}
              </button>
            ) : null}
            {canRunScheduler ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={runScheduler}
                disabled={schedulerLoading}
              >
                {schedulerLoading ? "Running..." : "Run Scheduler"}
              </button>
            ) : null}
            {canCreate ? (
              <Link to="/checklists/create" className="btn btn-success">
                Create Master
              </Link>
            ) : null}
          </div>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} masters</span>
          <span className="summary-chip summary-chip--neutral">{activeCount} active</span>
          <span className="summary-chip summary-chip--neutral">{inactiveCount} inactive</span>
          {selectedChecklistIds.length ? (
            <span className="summary-chip">{selectedChecklistIds.length} selected</span>
          ) : null}
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">
              Narrow checklist masters by name, status, or schedule type.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-5">
            <input
              className="form-control"
              placeholder="Search checklist number or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
            >
              <option value="">All schedules</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              {canDelete ? (
                <th className="text-center" style={{ width: "56px" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allRowsSelected}
                    onChange={toggleAllChecklistSelections}
                    disabled={!rows.length || bulkDeleteLoading}
                    aria-label="Select all checklist masters"
                  />
                </th>
              ) : null}
              <th>#</th>
              <th>Checklist Number</th>
              <th>Name</th>
              <th>Scoring</th>
              <th>Source Site</th>
              <th>Employee</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Next Task</th>
              <th>Approver Mapping</th>
              <th>Dependency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={canDelete ? "16" : "15"} className="text-center">
                  Loading checklist masters...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? "16" : "15"} className="text-center">
                  No checklist masters found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  {canDelete ? (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedChecklistIds.includes(String(row._id))}
                        onChange={() => toggleChecklistSelection(row._id)}
                        disabled={bulkDeleteLoading}
                        aria-label={`Select checklist master ${row.checklistNumber}`}
                      />
                    </td>
                  ) : null}
                  <td>{index + 1}</td>
                  <td>{row.checklistNumber}</td>
                  <td className="fw-semibold">{row.checklistName}</td>
                  <td>{formatChecklistScoreLabel(row)}</td>
                  <td>{getChecklistSiteName(row.checklistSourceSite) || "-"}</td>
                  <td>{formatEmployeeLabel(row.assignedToEmployee)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>
                    {formatDateTime(row.startDate)}
                    <div className="small text-muted">{row.scheduleTime || "-"}</div>
                  </td>
                  <td>
                    {formatDateTime(row.endDate)}
                    <div className="small text-muted">{row.endTime || "-"}</div>
                  </td>
                  <td>{formatDateTime(row.nextOccurrenceAt)}</td>
                  <td>{formatApprovalLabel(row)}</td>
                  <td>
                    <div>{formatChecklistDependencyLabel(row)}</div>
                    {row.isDependentTask ? (
                      <div className="small text-muted">
                        Target: {formatTargetDayCountLabel(row.targetDayCount)}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge ${row.status ? "bg-success" : "bg-secondary"}`}>
                      {row.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="app-icon-action-group justify-content-center">
                      <Link
                        className="btn btn-sm btn-outline-info app-icon-action-btn"
                        to={`/checklists/${row._id}`}
                        title="View checklist master"
                        aria-label={`View checklist master ${row.checklistNumber}`}
                      >
                        <ViewIcon />
                      </Link>
                      {canEdit ? (
                        <Link
                          className="btn btn-sm btn-outline-warning app-icon-action-btn"
                          to={`/checklists/edit/${row._id}`}
                          title="Edit checklist master"
                          aria-label={`Edit checklist master ${row.checklistNumber}`}
                        >
                          <EditIcon />
                        </Link>
                      ) : null}
                      {canToggle ? (
                        <button
                          type="button"
                          className={`btn btn-sm app-icon-action-btn ${
                            row.status ? "btn-outline-secondary" : "btn-outline-success"
                          }`}
                          onClick={() => toggleChecklistStatus(row._id)}
                          title={row.status ? "Deactivate checklist master" : "Activate checklist master"}
                          aria-label={`${
                            row.status ? "Deactivate" : "Activate"
                          } checklist master ${row.checklistNumber}`}
                        >
                          <ToggleIcon active={row.status} />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger app-icon-action-btn"
                          onClick={() => deleteChecklist(row._id)}
                          title="Delete checklist master"
                          aria-label={`Delete checklist master ${row.checklistNumber}`}
                        >
                          <DeleteIcon />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function EmployeeChecklistTaskList({
  rows,
  loading,
  search,
  status,
  scheduleType,
  setSearch,
  setStatus,
  setScheduleType,
  clearFilters,
  canViewOwnTasks,
  canViewApprovalInbox,
}) {
  const openCount = rows.filter((row) => row.status === "open").length;
  const waitingDependencyCount = rows.filter(
    (row) => String(row.status || "").trim().toLowerCase() === "waiting_dependency"
  ).length;
  const pendingApprovalCount = rows.filter((row) =>
    ["submitted", "nil_for_approval"].includes(String(row.status || ""))
  ).length;
  const hasFilters = Boolean(search.trim() || status || scheduleType);

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">My Checklist Tasks</h3>
            <div className="page-subtitle">
              Open your assigned recurring tasks, answer the task questions, and submit them for approval.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canViewOwnTasks ? (
              <Link to="/own-tasks" className="btn btn-outline-secondary">
                Own Tasks
              </Link>
            ) : null}
            {canViewApprovalInbox ? (
              <Link to="/checklists/approvals" className="btn btn-outline-primary">
                Approval Inbox
              </Link>
            ) : null}
          </div>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} tasks</span>
          <span className="summary-chip summary-chip--neutral">{openCount} assigned</span>
          <span className="summary-chip summary-chip--neutral">
            {waitingDependencyCount} waiting dependency
          </span>
          <span className="summary-chip summary-chip--neutral">
            {pendingApprovalCount} under approval
          </span>
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">Narrow tasks by name, status, or schedule.</div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <input
              className="form-control"
              placeholder="Search task number or checklist name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="waiting_dependency">Waiting for Dependency</option>
              <option value="open">Assigned</option>
              <option value="submitted">Under Approval</option>
              <option value="nil_for_approval">Nil For Approval</option>
              <option value="approved">Approved / Completed</option>
              <option value="nil_approved">Nil Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
            >
              <option value="">All schedules</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Task Number</th>
              <th>Checklist</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Occurrence</th>
              <th>Delay/Advance</th>
              <th>Final Mark</th>
              <th>Approval Type</th>
              <th>Current Approver</th>
              <th>Dependency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="13" className="text-center">
                  Loading checklist tasks...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="13" className="text-center">
                  No checklist tasks found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => {
                return (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.taskNumber}</td>
                  <td className="fw-semibold">{row.checklistName}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatTaskMarkDayLabel(row)}</td>
                  <td>{formatTaskFinalMarkLabel(row)}</td>
                  <td>
                    <span className={`badge ${getApprovalTypeBadgeClass(row)}`}>
                      {formatApprovalTypeLabel(row)}
                    </span>
                  </td>
                  <td>{formatCurrentApproverLabel(row)}</td>
                  <td>
                    {row.isDependentTask ? (
                      <>
                        <span className={`badge ${getChecklistDependencyStatusBadgeClass(row)}`}>
                          {formatChecklistDependencyStatus(row)}
                        </span>
                        <div className="small text-muted mt-1">
                          {formatChecklistDependencyLabel(row)}
                        </div>
                        <div className="small text-muted">
                          Target: {formatTargetDayCountLabel(row.targetDayCount)}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                      {formatChecklistTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    {String(row.status || "").trim().toLowerCase() === "waiting_dependency" ? (
                      <button type="button" className="btn btn-sm btn-secondary" disabled>
                        Locked
                      </button>
                    ) : (
                      <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

