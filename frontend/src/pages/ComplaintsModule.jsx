import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { usePermissions } from "../context/usePermissions";
import {
  formatComplaintDateTime,
  formatComplaintDuration,
  getComplaintTimeState,
} from "../utils/complaintLifecycle";

const defaultForm = {
  departmentId: "",
  complaintText: "",
  attachment: null,
};

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending_department_head", label: "Pending Department Head" },
  { value: "pending_site_head", label: "Pending Site Head" },
  { value: "pending_main_admin", label: "Pending Main Admin" },
  { value: "completed", label: "Resolved / Completed" },
];

const getStatusBadgeClass = (timeState) => {
  if (timeState?.isOverdue) return "text-bg-danger";
  if (timeState?.tone === "success") {
    return "bg-success-subtle text-success border border-success-subtle";
  }
  if (timeState?.tone === "warning") {
    return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
  }
  return "bg-info-subtle text-info-emphasis border border-info-subtle";
};

const getActionBadgeClass = (value) =>
  value
    ? "bg-primary-subtle text-primary border border-primary-subtle"
    : "bg-light text-muted border";

const getTimerTextClass = (timeState) => {
  if (timeState?.isOverdue) return "text-danger fw-semibold";
  if (timeState?.isDueSoon) return "text-warning-emphasis fw-semibold";
  if (timeState?.completed) return "text-success fw-semibold";
  return "text-info-emphasis fw-semibold";
};

const getTimerSummaryLabel = (timeState) => {
  if (!timeState) return "-";
  if (timeState.completed && timeState.isOverdue) {
    return `Overdue by ${formatComplaintDuration(timeState.overdueMs)} before completion`;
  }
  if (timeState.completed) {
    return `Resolved in ${formatComplaintDuration(timeState.elapsedMs)}`;
  }
  if (timeState.isOverdue) {
    return `Overdue by ${formatComplaintDuration(timeState.overdueMs)}`;
  }
  return `Remaining ${formatComplaintDuration(timeState.remainingMs)}`;
};

export default function ComplaintsModule() {
  const { can, user } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const canViewComplaints = can("complaints", "view");
  const canAddComplaint = can("complaints", "add");
  const isEmployeePrincipal = user?.principalType === "employee";

  const [options, setOptions] = useState({
    currentEmployee: null,
    departments: [],
  });
  const [form, setForm] = useState(defaultForm);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    actionRequired: 0,
    completed: 0,
  });
  const [filters, setFilters] = useState({
    status: "",
    actionRequiredOnly: false,
  });
  const [selectedComplaintId, setSelectedComplaintId] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [actionRemark, setActionRemark] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  const currentEmployee = options.currentEmployee;
  const departmentOptions = useMemo(
    () => (Array.isArray(options.departments) ? options.departments : []),
    [options.departments]
  );
  const selectedComplaintTimeState = useMemo(
    () => (selectedComplaint ? getComplaintTimeState(selectedComplaint, clockNow) : null),
    [clockNow, selectedComplaint]
  );

  const loadComplaints = useCallback(async (nextFilters = {
    status: "",
    actionRequiredOnly: false,
  }) => {
    setLoading(true);

    try {
      const response = await api.get("/complaints", {
        params: {
          status: nextFilters.status || undefined,
          actionRequiredOnly: nextFilters.actionRequiredOnly || undefined,
        },
      });

      setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
      setSummary(
        response.data?.summary || {
          total: 0,
          actionRequired: 0,
          completed: 0,
        }
      );
    } catch (error) {
      console.error("Complaint list load failed:", error);
      setRows([]);
      setSummary({
        total: 0,
        actionRequired: 0,
        completed: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComplaintDetail = async (complaintId) => {
    if (!complaintId) {
      setSelectedComplaint(null);
      setActionRemark("");
      return;
    }

    setDetailLoading(true);

    try {
      const response = await api.get(`/complaints/${complaintId}`);
      setSelectedComplaint(response.data || null);
      setActionRemark("");
      setSelectedComplaintId(complaintId);
    } catch (error) {
      console.error("Complaint detail load failed:", error);
      setSelectedComplaint(null);
      alert(error.response?.data?.message || "Failed to load complaint details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewComplaints) return;

    const loadOptions = async () => {
      try {
        const response = await api.get("/complaints/options");
        const nextOptions = {
          currentEmployee: response.data?.currentEmployee || null,
          departments: Array.isArray(response.data?.departments)
            ? response.data.departments
            : [],
        };
        setOptions(nextOptions);
      } catch (error) {
        console.error("Complaint options load failed:", error);
        setOptions({
          currentEmployee: null,
          departments: [],
        });
      }
    };

    void loadOptions();
    void loadComplaints({
      status: "",
      actionRequiredOnly: false,
    });
  }, [canViewComplaints, loadComplaints]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const complaintId = String(searchParams.get("complaintId") || "").trim();
    if (!complaintId) return;

    void loadComplaintDetail(complaintId);
  }, [searchParams]);

  const handleCreateComplaint = async () => {
    if (!form.departmentId) {
      alert("Select a department");
      return;
    }

    if (!form.complaintText.trim()) {
      alert("Enter complaint details");
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("departmentId", form.departmentId);
      payload.append("complaintText", form.complaintText.trim());

      if (form.attachment) {
        payload.append("attachment", form.attachment);
      }

      const response = await api.post("/complaints", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const complaintId = response.data?.complaint?._id || "";
      alert(response.data?.message || "Complaint submitted successfully");
      setForm((current) => ({
        ...current,
        complaintText: "",
        attachment: null,
      }));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadComplaints(filters);

      if (complaintId) {
        setSearchParams({ complaintId });
        await loadComplaintDetail(complaintId);
      }
    } catch (error) {
      console.error("Complaint create failed:", error);
      alert(error.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action) => {
    if (!selectedComplaintId) return;

    setActionSaving(true);

    try {
      const response = await api.patch(`/complaints/${selectedComplaintId}/action`, {
        action,
        remark: actionRemark,
      });

      alert(response.data?.message || "Complaint updated successfully");
      await loadComplaints(filters);
      await loadComplaintDetail(selectedComplaintId);
    } catch (error) {
      console.error("Complaint action failed:", error);
      alert(error.response?.data?.message || "Failed to update complaint");
    } finally {
      setActionSaving(false);
    }
  };

  const clearSelectedComplaint = () => {
    setSelectedComplaintId("");
    setSelectedComplaint(null);
    setActionRemark("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("complaintId");
    setSearchParams(nextParams);
  };

  if (!canViewComplaints) {
    return <div className="container mt-4">You do not have access to this module.</div>;
  }

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Workspace</div>
            <h3 className="mb-1">Complaints</h3>
            <p className="page-subtitle mb-0">
              Every complaint runs on one shared 24-hour action window from the raised time,
              across department head, site head, and main admin together.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <span className="badge text-bg-light border px-3 py-2">
              Total: {summary.total || 0}
            </span>
            <span className="badge text-bg-warning px-3 py-2">
              Action Required: {summary.actionRequired || 0}
            </span>
            <span className="badge text-bg-success px-3 py-2">
              Completed: {summary.completed || 0}
            </span>
          </div>
        </div>
      </div>

      {canAddComplaint && isEmployeePrincipal ? (
        <div className="soft-card mb-4">
          <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
            <div>
              <h5 className="mb-1">Submit Complaint</h5>
              <div className="text-muted small">
                Employee name and site are filled from your logged-in profile.
              </div>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Employee Name</label>
              <input
                className="form-control"
                value={currentEmployee?.employeeName || user?.name || ""}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Site</label>
              <input
                className="form-control"
                value={currentEmployee?.siteDisplayName || "No mapped site"}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Department</label>
              <select
                className="form-select"
                value={form.departmentId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, departmentId: event.target.value }))
                }
              >
                <option value="">Select Department</option>
                {departmentOptions.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Attachment</label>
              <input
                ref={fileInputRef}
                type="file"
                className="form-control"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    attachment: event.target.files?.[0] || null,
                  }))
                }
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Complaint Box</label>
              <textarea
                className="form-control"
                rows="5"
                placeholder="Describe the complaint in detail"
                value={form.complaintText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, complaintText: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateComplaint}
              disabled={saving}
            >
              {saving ? "Submitting..." : "Submit Complaint"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="soft-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-4 col-xl-3">
            <label className="form-label fw-semibold">Workflow Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {!isEmployeePrincipal ? (
            <div className="col-12 col-md-4 col-xl-3">
              <label className="form-label fw-semibold d-block">Queue</label>
              <div className="form-check">
                <input
                  id="complaints-action-required"
                  type="checkbox"
                  className="form-check-input"
                  checked={filters.actionRequiredOnly}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      actionRequiredOnly: event.target.checked,
                    }))
                  }
                />
                <label htmlFor="complaints-action-required" className="form-check-label">
                  Show only action-required complaints
                </label>
              </div>
            </div>
          ) : null}
          <div className="col-12 col-md-4 col-xl-3">
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => loadComplaints(filters)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="table-shell mb-4">
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Complaint</th>
                <th>Department / Site</th>
                <th>Level</th>
                <th>Status</th>
                <th>Updated</th>
                <th width="140">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    Loading complaints...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    No complaints found for the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const timeState = getComplaintTimeState(row, clockNow);

                  return (
                    <tr key={row._id} className={timeState.isOverdue ? "table-danger" : ""}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="fw-semibold">{row.complaintCode}</div>
                        <div className="small text-muted">
                          {row.employeeName}
                          {row.employeeCode ? ` (${row.employeeCode})` : ""}
                        </div>
                        <div className="small text-muted">
                          {row.complaintText || "No complaint details"}
                        </div>
                        <div className="small text-muted mt-2">
                          Raised: {formatComplaintDateTime(timeState.raisedAt)}
                        </div>
                        <div className="small text-muted">
                          Deadline: {formatComplaintDateTime(timeState.deadlineAt)}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">{row.departmentName || "-"}</div>
                        <div className="small text-muted">{row.siteDisplayName || "-"}</div>
                      </td>
                      <td>
                        <span className="badge text-bg-light border text-dark">
                          {row.currentLevelLabel}
                        </span>
                        <div className="small text-muted mt-1">
                          {row.isActionRequired ? "Your action is pending" : "Tracking only"}
                        </div>
                        <div className="small text-muted mt-1">
                          Workflow: {row.workflowStatusLabel || "-"}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <span className={`badge ${getStatusBadgeClass(timeState)}`}>
                            {timeState.statusLabel}
                          </span>
                          {timeState.isOverdue ? (
                            <span className="badge text-bg-danger">Alert</span>
                          ) : null}
                        </div>
                        <div className={`small mt-2 ${getTimerTextClass(timeState)}`}>
                          {getTimerSummaryLabel(timeState)}
                        </div>
                      </td>
                      <td>
                        <div>{row.updatedAtLabel}</div>
                        {!timeState.completed && !timeState.isOverdue ? (
                          <div className="small text-info-emphasis">
                            Remaining: {formatComplaintDuration(timeState.remainingMs)}
                          </div>
                        ) : null}
                        {timeState.isOverdue ? (
                          <div className="small text-danger fw-semibold">
                            Overdue: {formatComplaintDuration(timeState.overdueMs)}
                          </div>
                        ) : null}
                        {row.completedAt ? (
                          <div className="small text-muted">Completed: {row.completedAtLabel}</div>
                        ) : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setSearchParams({ complaintId: row._id });
                            void loadComplaintDetail(row._id);
                          }}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="soft-card">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">Complaint Details</h5>
            <div className="small text-muted">
              Open a complaint to review the shared 24-hour deadline, routing, remarks, and available actions.
            </div>
          </div>
          {selectedComplaint ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearSelectedComplaint}>
              Clear
            </button>
          ) : null}
        </div>

        {detailLoading ? (
          <div className="text-muted">Loading complaint details...</div>
        ) : !selectedComplaint ? (
          <div className="text-muted">No complaint selected.</div>
        ) : (
          <>
            {selectedComplaintTimeState?.isOverdue ? (
              <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
                <div>
                  This complaint is overdue by{" "}
                  <strong>{formatComplaintDuration(selectedComplaintTimeState.overdueMs)}</strong>.
                </div>
                <span className="badge text-bg-danger">Alert</span>
              </div>
            ) : selectedComplaintTimeState?.isDueSoon ? (
              <div className="alert alert-warning py-2">
                This complaint is due soon. Remaining time:{" "}
                <strong>{formatComplaintDuration(selectedComplaintTimeState.remainingMs)}</strong>
              </div>
            ) : null}

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Complaint ID</label>
                <input className="form-control" value={selectedComplaint.complaintCode || ""} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Employee</label>
                <input className="form-control" value={selectedComplaint.employeeName || ""} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Department</label>
                <input className="form-control" value={selectedComplaint.departmentName || ""} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Site</label>
                <input className="form-control" value={selectedComplaint.siteDisplayName || ""} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Current Level</label>
                <input className="form-control" value={selectedComplaint.currentLevelLabel || ""} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Status</label>
                <input
                  className="form-control"
                  value={selectedComplaintTimeState?.statusLabel || selectedComplaint.statusLabel || ""}
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Raised Time</label>
                <input
                  className="form-control"
                  value={formatComplaintDateTime(selectedComplaintTimeState?.raisedAt)}
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Deadline Time</label>
                <input
                  className="form-control"
                  value={formatComplaintDateTime(selectedComplaintTimeState?.deadlineAt)}
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Remaining Time</label>
                <input
                  className="form-control"
                  value={
                    selectedComplaintTimeState?.completed ||
                    selectedComplaintTimeState?.isOverdue
                      ? "-"
                      : formatComplaintDuration(selectedComplaintTimeState?.remainingMs)
                  }
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Overdue Time</label>
                <input
                  className="form-control"
                  value={
                    selectedComplaintTimeState?.isOverdue
                      ? formatComplaintDuration(selectedComplaintTimeState?.overdueMs)
                      : "-"
                  }
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Department Head</label>
                <input className="form-control" value={selectedComplaint.departmentHeadName || "-"} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Site Head</label>
                <input className="form-control" value={selectedComplaint.siteHeadName || "-"} disabled />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Reminder Count</label>
                <input
                  className="form-control"
                  value={String(selectedComplaint.reminderCount || 0)}
                  disabled
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label fw-semibold">Last Reminder Sent</label>
                <input
                  className="form-control"
                  value={
                    selectedComplaint.reminderLastSentAt
                      ? formatComplaintDateTime(selectedComplaint.reminderLastSentAt)
                      : "-"
                  }
                  disabled
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Complaint Details</label>
                <textarea
                  className="form-control"
                  rows="5"
                  value={selectedComplaint.complaintText || ""}
                  disabled
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold d-block">Attachment</label>
                {selectedComplaint.attachment?.url ? (
                  <a
                    href={selectedComplaint.attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline-primary"
                  >
                    {selectedComplaint.attachment.originalName || "Open attachment"}
                  </a>
                ) : (
                  <div className="text-muted small">No attachment uploaded</div>
                )}
              </div>
            </div>

            <div className="row g-4">
              <div className="col-12 col-xl-6">
                <h6 className="mb-3">Remarks</h6>
                {selectedComplaint.remarks?.length ? (
                  <div className="d-flex flex-column gap-3">
                    {selectedComplaint.remarks.map((remark) => (
                      <div key={`${remark.label}-${remark.actedAt || remark.action}`} className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div className="fw-semibold">{remark.label}</div>
                          <span className={`badge ${getActionBadgeClass(remark.action)}`}>
                            {remark.actionLabel}
                          </span>
                        </div>
                        <div className="small text-muted mb-2">
                          {remark.actedByName || "-"} | {remark.actedAtLabel || "-"}
                        </div>
                        <div>{remark.remark || "No remark entered."}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted">No remarks added yet.</div>
                )}
              </div>

              <div className="col-12 col-xl-6">
                <h6 className="mb-3">Timeline</h6>
                {selectedComplaint.timeline?.length ? (
                  <div className="d-flex flex-column gap-3 mb-4">
                    {selectedComplaint.timeline.map((item, index) => (
                      <div key={`${item.level}-${item.action}-${item.actedAt || index}`} className="border rounded p-3">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="fw-semibold">
                            {item.levelLabel} - {item.actionLabel}
                          </div>
                          <div className="small text-muted">{item.actedAtLabel}</div>
                        </div>
                        <div className="small text-muted mt-1">{item.actedByName || "-"}</div>
                        <div className="mt-2">{item.remark || "No remark recorded."}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted mb-4">No timeline entries available.</div>
                )}

                {selectedComplaint.canAct ? (
                  <div className="border rounded p-3">
                    <h6 className="mb-3">Take Action</h6>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Remark</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        placeholder="Add your remark before moving this complaint ahead"
                        value={actionRemark}
                        onChange={(event) => setActionRemark(event.target.value)}
                      />
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      {selectedComplaint.availableActions?.includes("submit") ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={actionSaving}
                          onClick={() => handleAction("submit")}
                        >
                          {actionSaving ? "Saving..." : "Submit"}
                        </button>
                      ) : null}
                      {selectedComplaint.availableActions?.includes("forward") ? (
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          disabled={actionSaving}
                          onClick={() => handleAction("forward")}
                        >
                          {actionSaving ? "Saving..." : "Forward"}
                        </button>
                      ) : null}
                      {selectedComplaint.availableActions?.includes("complete") ? (
                        <button
                          type="button"
                          className="btn btn-success"
                          disabled={actionSaving}
                          onClick={() => handleAction("complete")}
                        >
                          {actionSaving ? "Saving..." : "Mark Completed"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">
                    This complaint is visible to you, but no action is pending at your level.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

