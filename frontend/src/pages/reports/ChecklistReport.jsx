import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalWorkflowLabel,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTimelinessLabel,
  formatTaskStatus,
  getApprovalWorkflowEmployees,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getTimelinessBadgeClass,
  getTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

const defaultFilters = {
  fromDate: "",
  toDate: "",
  status: "",
  scheduleType: "",
  assignedEmployee: "",
  timelinessStatus: "",
};

export default function ChecklistReport() {
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const response = await api.get("/employees", { params: { status: "active" } });
        setEmployees(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist report employee load failed:", err);
        setEmployees([]);
      }
    };

    void loadEmployees();
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);

      try {
        const response = await api.get("/checklists/tasks/report", {
          params: {
            search: search || undefined,
            fromDate: appliedFilters.fromDate || undefined,
            toDate: appliedFilters.toDate || undefined,
            status: appliedFilters.status || undefined,
            scheduleType: appliedFilters.scheduleType || undefined,
            assignedEmployee: appliedFilters.assignedEmployee || undefined,
            timelinessStatus: appliedFilters.timelinessStatus || undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist report load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [appliedFilters, search]);

  const applyFilters = () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      alert("From date cannot be greater than to date");
      return;
    }

    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="mb-1">Checklist Task Report</h3>
          <div className="text-muted">
            Track generated tasks, submission status, and approval movement across employees.
          </div>
        </div>

        <input
          className="form-control"
          style={{ maxWidth: "320px" }}
          placeholder="Search task number or checklist name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-2">
              <label className="form-label mb-1">From Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.fromDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                }
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1">To Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.toDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, toDate: event.target.value }))
                }
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1">Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-1">Schedule</label>
              <select
                className="form-select"
                value={filters.scheduleType}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, scheduleType: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1">Employee</label>
              <select
                className="form-select"
                value={filters.assignedEmployee}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, assignedEmployee: event.target.value }))
                }
              >
                <option value="">All Employees</option>
                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {formatEmployeeLabel(employee)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-1">
              <label className="form-label mb-1">Time</label>
              <select
                className="form-select"
                value={filters.timelinessStatus}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, timelinessStatus: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="advanced">Advanced</option>
                <option value="on_time">On Time</option>
                <option value="delay">Delay</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Task Number</th>
              <th>Checklist</th>
              <th>Employee</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Submitted At</th>
              <th>Time Status</th>
              <th>Current Approver</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="13" className="text-center">
                  Loading checklist task report...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="13" className="text-center">
                  No checklist task records found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => {
                const currentApproverLabel = formatCurrentApproverLabel(row);
                const approvalWorkflowLabel = formatApprovalWorkflowLabel(row);
                const workflowCount = getApprovalWorkflowEmployees(row).length;
                const approverPrimaryLabel =
                  currentApproverLabel && currentApproverLabel !== "-"
                    ? currentApproverLabel
                    : approvalWorkflowLabel;
                const showWorkflowLabel =
                  workflowCount > 1 &&
                  approvalWorkflowLabel &&
                  approvalWorkflowLabel !== "-";

                return (
                  <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.taskNumber}</td>
                  <td>
                    <div className="fw-semibold">{row.checklistName}</div>
                    <div className="small text-muted">{row.checklistNumber}</div>
                  </td>
                  <td>{formatEmployeeLabel(row.assignedEmployee)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatDateTime(row.endDateTime)}</td>
                  <td>{formatDateTime(row.submittedAt)}</td>
                  <td>
                    <span className={`badge ${getTimelinessBadgeClass(row.timelinessStatus)}`}>
                      {formatTimelinessLabel(row.timelinessStatus)}
                    </span>
                  </td>
                  <td>
                    <div>{approverPrimaryLabel || "-"}</div>
                    {showWorkflowLabel && (
                      <div className="small text-muted">Workflow: {approvalWorkflowLabel}</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getTaskStatusBadgeClass(row.status)}`}>
                      {formatTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      View
                    </Link>
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
