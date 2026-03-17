import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalLabel,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskStatus,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");
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
  const user = getUser();
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        const response = await api.get(isAdmin ? "/checklists" : "/checklists/tasks/my", {
          params: {
            search: search || undefined,
            status: status || undefined,
            scheduleType: scheduleType || undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist list load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [isAdmin, scheduleType, search, status]);

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
      setRows((prev) => prev.filter((row) => row._id !== id));
    } catch (err) {
      console.error("Checklist delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete checklist master");
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

  return isAdmin ? (
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
      runScheduler={runScheduler}
      schedulerLoading={schedulerLoading}
    />
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
  runScheduler,
  schedulerLoading,
}) {
  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="mb-1">Checklist Master</h3>
          <div className="text-muted">
            Create recurring checklist definitions and auto-generate employee tasks.
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={runScheduler}
            disabled={schedulerLoading}
          >
            {schedulerLoading ? "Running..." : "Run Scheduler"}
          </button>
          <Link to="/checklists/create" className="btn btn-success">
            + Create Master
          </Link>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-2">
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
                <option value="">All Status</option>
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
                <option value="">All Schedules</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Checklist Number</th>
              <th>Name</th>
              <th>Mark</th>
              <th>Source Site</th>
              <th>Employee</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Next Task</th>
              <th>Approver Mapping</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="14" className="text-center">
                  Loading checklist masters...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="14" className="text-center">
                  No checklist masters found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.checklistNumber}</td>
                  <td className="fw-semibold">{row.checklistName}</td>
                  <td>{row.checklistMark ?? 1}</td>
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
                    <span className={`badge ${row.status ? "bg-success" : "bg-secondary"}`}>
                      {row.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-1 justify-content-center">
                      <Link
                        className="btn btn-sm btn-outline-info"
                        to={`/checklists/${row._id}`}
                        title="View checklist master"
                        aria-label={`View checklist master ${row.checklistNumber}`}
                      >
                        <ViewIcon />
                      </Link>
                      <Link
                        className="btn btn-sm btn-outline-warning"
                        to={`/checklists/edit/${row._id}`}
                        title="Edit checklist master"
                        aria-label={`Edit checklist master ${row.checklistNumber}`}
                      >
                        <EditIcon />
                      </Link>
                      <button
                        type="button"
                        className={`btn btn-sm ${
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
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteChecklist(row._id)}
                        title="Delete checklist master"
                        aria-label={`Delete checklist master ${row.checklistNumber}`}
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
}) {
  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h3 className="mb-1">My Checklist Tasks</h3>
          <div className="text-muted">
            Open your assigned recurring tasks, verify the checklist, add remarks, and submit.
          </div>
        </div>

        <Link to="/checklists/approvals" className="btn btn-outline-primary">
          Approval Inbox
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-2">
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
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={scheduleType}
                onChange={(event) => setScheduleType(event.target.value)}
              >
                <option value="">All Schedules</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
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
              <th>Priority</th>
              <th>Schedule</th>
              <th>Occurrence</th>
              <th>Current Approver</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="text-center">
                  Loading checklist tasks...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="9" className="text-center">
                  No checklist tasks found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => (
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
                  <td>{formatCurrentApproverLabel(row)}</td>
                  <td>
                    <span className={`badge ${getTaskStatusBadgeClass(row.status)}`}>
                      {formatTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      Open
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
