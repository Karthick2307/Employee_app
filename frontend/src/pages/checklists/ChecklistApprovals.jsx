import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../../api/axios";
import {
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatTaskStatus,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getTaskStatusBadgeClass,
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

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="mb-1">Approval Inbox</h3>
          <div className="text-muted">
            Only checklist submissions mapped to you appear here.
          </div>
        </div>

        <Link to="/checklists" className="btn btn-outline-secondary">
          Back to My Tasks
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <input
            className="form-control"
            placeholder="Search task number or checklist name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
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
              <th>Occurrence</th>
              <th>Submitted At</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="text-center">
                  Loading approval tasks...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center">
                  No approval requests are mapped to you right now
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => (
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
                    <span className={`badge ${getTaskStatusBadgeClass(row.status)}`}>
                      {formatTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
