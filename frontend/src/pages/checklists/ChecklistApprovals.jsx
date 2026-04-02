import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalTypeLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatChecklistTaskStatus,
  formatPriorityLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  getApprovalTypeBadgeClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getChecklistTaskStatusBadgeClass,
  isNilChecklistTask,
} from "../../utils/checklistDisplay";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

export default function ChecklistApprovals() {
  const user = getUser();
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadApprovals = async () => {
      setLoading(true);

      try {
        const response = await api.get("/checklists/tasks/approvals", {
          params: { search: search || undefined },
        });
        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist approvals load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadApprovals();
  }, [search]);

  if (isAdmin) {
    return <Navigate to="/checklists" replace />;
  }

  const submittedCount = rows.filter((row) =>
    ["submitted", "nil_for_approval"].includes(String(row.status || ""))
  ).length;
  const nilApprovalCount = rows.filter((row) => isNilChecklistTask(row)).length;
  const rejectedCount = rows.filter((row) => row.status === "rejected").length;

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">Approval Inbox</h3>
            <div className="page-subtitle">
              Only checklist submissions mapped to you appear here.
            </div>
          </div>

          <Link to="/checklists" className="btn btn-outline-secondary">
            Back to My Tasks
          </Link>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} requests</span>
          <span className="summary-chip summary-chip--neutral">{submittedCount} under approval</span>
          <span className="summary-chip summary-chip--neutral">{nilApprovalCount} nil flow</span>
          <span className="summary-chip summary-chip--neutral">{rejectedCount} rejected</span>
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Search</h6>
            <div className="form-help">
              Search by task number or checklist name to find approvals faster.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setSearch("")}
            disabled={!search}
          >
            Clear Search
          </button>
        </div>

        <input
          className="form-control mt-3"
          placeholder="Search task number or checklist name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Task Number</th>
              <th>Checklist</th>
              <th>Employee</th>
              <th>Priority</th>
              <th>Occurrence</th>
              <th>Submitted At</th>
              <th>Approval Type</th>
              <th>Delay/Advance</th>
              <th>Final Mark</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="12" className="text-center">
                  Loading approval tasks...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="12" className="text-center">
                  No approval requests are mapped to you right now
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
                  <td>{formatEmployeeLabel(row.assignedEmployee)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatDateTime(row.submittedAt)}</td>
                  <td>
                    <span className={`badge ${getApprovalTypeBadgeClass(row)}`}>
                      {formatApprovalTypeLabel(row)}
                    </span>
                  </td>
                  <td>{formatTaskMarkDayLabel(row)}</td>
                  <td>{formatTaskFinalMarkLabel(row)}</td>
                  <td>
                    <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                      {formatChecklistTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      Review
                    </Link>
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
