import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { usePermissions } from "../../context/PermissionContext";
import {
  ATTENDANCE_STATUS_OPTIONS,
  REGULARIZATION_STATUS_OPTIONS,
  buildAttendanceQueryParams,
  getAttendanceStatusBadgeClass,
  getCurrentMonthValue,
  getRegularizationStatusLabel,
  getTodayDateInputValue,
} from "../../utils/attendance";

const defaultForm = {
  employeeId: "",
  attendanceDate: getTodayDateInputValue(),
  requestedCheckInTime: "",
  requestedCheckOutTime: "",
  requestedStatus: "present",
  reason: "",
  requestRemarks: "",
};

const defaultFilters = {
  fromDate: `${getCurrentMonthValue()}-01`,
  toDate: getTodayDateInputValue(),
  status: "",
};

export default function AttendanceRegularization() {
  const { can, user } = usePermissions();
  const canAddRequest = can("attendance_regularization", "add");
  const canApprove = can("attendance_regularization", "approve");
  const canReject = can("attendance_regularization", "reject");
  const isEmployeePrincipal = user?.principalType === "employee";
  const [options, setOptions] = useState({
    employees: [],
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRequests = async (nextFilters = filters) => {
    setLoading(true);

    try {
      const response = await api.get("/attendance/regularization", {
        params: buildAttendanceQueryParams(nextFilters),
      });
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Attendance regularization load failed:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await api.get("/attendance/options");
        const employeeRows = Array.isArray(response.data?.employees) ? response.data.employees : [];
        setOptions({
          employees: employeeRows,
        });

        if (isEmployeePrincipal && response.data?.currentPrincipalEmployeeId) {
          setForm((current) => ({
            ...current,
            employeeId: response.data.currentPrincipalEmployeeId,
          }));
        }
      } catch (error) {
        console.error("Attendance regularization options load failed:", error);
        setOptions({ employees: [] });
      }
    };

    void loadOptions();
    void loadRequests(filters);
  }, []);

  const availableEmployees = useMemo(() => options.employees, [options.employees]);

  const handleCreate = async () => {
    if (!form.reason.trim()) {
      alert("Enter a reason for the regularization request");
      return;
    }

    if (!isEmployeePrincipal && !form.employeeId) {
      alert("Select an employee for the regularization request");
      return;
    }

    setSaving(true);

    try {
      await api.post("/attendance/regularization", {
        employeeId: form.employeeId || undefined,
        attendanceDate: form.attendanceDate,
        requestedCheckInTime: form.requestedCheckInTime || null,
        requestedCheckOutTime: form.requestedCheckOutTime || null,
        requestedStatus: form.requestedStatus,
        reason: form.reason,
        requestRemarks: form.requestRemarks,
      });
      alert("Regularization request submitted successfully");
      setForm((current) => ({
        ...defaultForm,
        employeeId: isEmployeePrincipal ? current.employeeId : "",
      }));
      await loadRequests();
    } catch (error) {
      console.error("Attendance regularization save failed:", error);
      alert(error.response?.data?.message || "Failed to submit regularization request");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (requestId, actionKey) => {
    const decisionRemarks = window.prompt(
      actionKey === "approve" ? "Approval remarks (optional)" : "Rejection reason (optional)",
      ""
    );

    try {
      await api.patch(`/attendance/regularization/${requestId}/${actionKey}`, {
        decisionRemarks: decisionRemarks || "",
      });
      await loadRequests();
    } catch (error) {
      console.error(`Attendance regularization ${actionKey} failed:`, error);
      alert(error.response?.data?.message || `Failed to ${actionKey} request`);
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">Attendance Regularization</h2>
          <div className="text-muted">
            Submit missed or incorrect attendance corrections and review approval decisions.
          </div>
        </div>
      </div>

      {canAddRequest ? (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h5 className="mb-3">Create Regularization Request</h5>
            <div className="row g-3">
              {!isEmployeePrincipal ? (
                <div className="col-12 col-md-6 col-xl-4">
                  <label className="form-label">Employee</label>
                  <select
                    className="form-select"
                    value={form.employeeId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, employeeId: event.target.value }))
                    }
                  >
                    <option value="">Select Employee</option>
                    {availableEmployees.map((employee) => (
                      <option key={employee.value} value={employee.value}>
                        {employee.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.attendanceDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, attendanceDate: event.target.value }))
                  }
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Requested Check In</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.requestedCheckInTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedCheckInTime: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Requested Check Out</label>
                <input
                  type="time"
                  className="form-control"
                  value={form.requestedCheckOutTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      requestedCheckOutTime: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Requested Status</label>
                <select
                  className="form-select"
                  value={form.requestedStatus}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requestedStatus: event.target.value }))
                  }
                >
                  {ATTENDANCE_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption.value} value={statusOption.value}>
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-xl-4">
                <label className="form-label">Reason</label>
                <input
                  className="form-control"
                  placeholder="Why should this attendance be corrected?"
                  value={form.reason}
                  onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                />
              </div>
              <div className="col-12 col-xl-8">
                <label className="form-label">Remarks</label>
                <input
                  className="form-control"
                  placeholder="Additional details"
                  value={form.requestRemarks}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, requestRemarks: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-4 col-xl-3">
              <label className="form-label">From Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.fromDate}
                onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-4 col-xl-3">
              <label className="form-label">To Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.toDate}
                onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-4 col-xl-3">
              <label className="form-label">Request Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All Statuses</option>
                {REGULARIZATION_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => loadRequests(filters)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="mb-3">Regularization Requests</h5>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Requested Status</th>
                  <th>Current Status</th>
                  <th>Reason</th>
                  <th>Remarks</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center">
                      Loading regularization requests...
                    </td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No attendance regularization requests found
                    </td>
                  </tr>
                ) : (
                  requests.map((row) => (
                    <tr key={row._id}>
                      <td>{row.employeeDisplayName}</td>
                      <td>{row.attendanceDateLabel}</td>
                      <td>
                        <span className={`badge ${getAttendanceStatusBadgeClass(row.requestedStatus)}`}>
                          {row.requestedStatusLabel}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {row.statusLabel || getRegularizationStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.reason}</td>
                      <td>{row.requestRemarks || "-"}</td>
                      <td>
                        {row.status === "pending" && (canApprove || canReject) ? (
                          <div className="d-flex flex-wrap gap-2">
                            {canApprove ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                onClick={() => handleDecision(row._id, "approve")}
                              >
                                Approve
                              </button>
                            ) : null}
                            {canReject ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDecision(row._id, "reject")}
                              >
                                Reject
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          row.decisionRemarks || "Closed"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
