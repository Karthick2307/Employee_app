import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTimelinessLabel,
  formatTaskStatus,
  getPriorityBadgeClass,
  getTimelinessBadgeClass,
  getTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

export default function ChecklistTaskView() {
  const { id } = useParams();
  const user = getUser();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [employeeRemarks, setEmployeeRemarks] = useState("");
  const [itemResponses, setItemResponses] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const uploadBaseUrl = (api.defaults.baseURL || "http://localhost:5000/api").replace(
    /\/api\/?$/,
    ""
  );

  const isAssignedEmployee =
    String(task?.assignedEmployee?._id || task?.assignedEmployee || "") === String(user?.id || "");
  const isCurrentApprover =
    String(task?.currentApprovalEmployee?._id || task?.currentApprovalEmployee || "") ===
    String(user?.id || "");

  const canSubmit = isAssignedEmployee && task?.status === "open";
  const canDecide = isCurrentApprover && task?.status === "submitted";

  const loadTask = async () => {
    setLoading(true);

    try {
      const response = await api.get(`/checklists/tasks/${id}`);
      const taskData = response.data || null;

      setTask(taskData);
      setEmployeeRemarks(taskData?.employeeRemarks || "");
      setItemResponses(
        Array.isArray(taskData?.checklistItems)
          ? taskData.checklistItems.map((item) => ({
              checklistItemId: item.checklistItemId || item._id,
              verified: item.verified === true,
              remarks: item.remarks || "",
            }))
          : []
      );
      setAttachments([]);
      setDecisionRemarks("");
    } catch (err) {
      console.error("Checklist task load failed:", err);
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTask();
  }, [id]);

  const updateItemResponse = (checklistItemId, key, value) => {
    setItemResponses((prev) =>
      prev.map((item) =>
        String(item.checklistItemId) === String(checklistItemId)
          ? { ...item, [key]: value }
          : item
      )
    );
  };

  const handleSubmitTask = async () => {
    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("employeeRemarks", employeeRemarks);
      payload.append("itemResponses", JSON.stringify(itemResponses));

      Array.from(attachments || []).forEach((file) => {
        payload.append("attachments", file);
      });

      await api.post(`/checklists/tasks/${id}/submit`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadTask();
      alert("Checklist task submitted successfully.");
    } catch (err) {
      console.error("Checklist task submit failed:", err);
      alert(err.response?.data?.message || "Failed to submit checklist task");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (action) => {
    setDecisionLoading(true);

    try {
      await api.post(`/checklists/tasks/${id}/decision`, {
        action,
        remarks: decisionRemarks,
      });

      await loadTask();
      alert(
        `Checklist task ${action === "approve" ? "approved" : "rejected"} successfully.`
      );
    } catch (err) {
      console.error("Checklist decision failed:", err);
      alert(err.response?.data?.message || "Failed to update checklist approval");
    } finally {
      setDecisionLoading(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading checklist task...</div>;
  }

  if (!task) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">Checklist task not found.</div>
        <Link className="btn btn-outline-secondary" to="/checklists">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Checklist Task</h3>
          <div className="text-muted">
            Review the generated task, complete the checklist, and move it through approval.
          </div>
        </div>

        <Link className="btn btn-outline-secondary" to="/checklists">
          Back
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="row g-3">
            <Info label="Task Number" value={task.taskNumber} />
            <Info label="Checklist Number" value={task.checklistNumber} />
            <Info label="Checklist Name" value={task.checklistName} />
            <Info label="Assigned Employee" value={formatEmployeeLabel(task.assignedEmployee)} />
            <Info
              label="Priority"
              value={
                <span className={`badge ${getPriorityBadgeClass(task.priority || task.checklist)}`}>
                  {formatPriorityLabel(task)}
                </span>
              }
            />
            <Info label="Schedule Type" value={formatScheduleLabel(task)} />
            <Info label="Start Date / Time" value={formatDateTime(task.occurrenceDate)} />
            <Info label="End Date / Time" value={formatDateTime(task.endDateTime)} />
            <Info label="Submitted At" value={formatDateTime(task.submittedAt)} />
            <Info label="Current Approver" value={formatCurrentApproverLabel(task)} />
            <Info
              label="Time Status"
              value={
                <span className={`badge ${getTimelinessBadgeClass(task.timelinessStatus)}`}>
                  {formatTimelinessLabel(task.timelinessStatus)}
                </span>
              }
            />
            <Info
              label="Status"
              value={
                <span className={`badge ${getTaskStatusBadgeClass(task.status)}`}>
                  {formatTaskStatus(task.status)}
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Checklist Verification</h5>
            {canSubmit && <span className="badge bg-primary">Editable</span>}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Detail</th>
                  <th style={{ width: "120px" }}>Verified</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {task.checklistItems?.map((item, index) => {
                  const response =
                    itemResponses.find(
                      (row) => String(row.checklistItemId) === String(item.checklistItemId || item._id)
                    ) || {};

                  return (
                    <tr key={item._id || item.checklistItemId || index}>
                      <td>{index + 1}</td>
                      <td>
                        {item.label}
                        {item.isRequired !== false && (
                          <span className="badge bg-light text-dark border ms-2">Required</span>
                        )}
                      </td>
                      <td>{item.detail || "-"}</td>
                      <td>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={response.verified === true}
                            disabled={!canSubmit}
                            onChange={(event) =>
                              updateItemResponse(
                                item.checklistItemId || item._id,
                                "verified",
                                event.target.checked
                              )
                            }
                          />
                          <label className="form-check-label">Done</label>
                        </div>
                      </td>
                      <td>
                        <input
                          className="form-control"
                          value={response.remarks || ""}
                          disabled={!canSubmit}
                          onChange={(event) =>
                            updateItemResponse(
                              item.checklistItemId || item._id,
                              "remarks",
                              event.target.value
                            )
                          }
                          placeholder="Optional remarks"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-md-8">
              <label className="form-label fw-semibold">Employee Remarks</label>
              <textarea
                className="form-control"
                rows="3"
                value={employeeRemarks}
                disabled={!canSubmit}
                onChange={(event) => setEmployeeRemarks(event.target.value)}
                placeholder="Add a summary, issue note, or completion remarks"
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Attachments</label>
              <input
                type="file"
                multiple
                className="form-control"
                disabled={!canSubmit}
                onChange={(event) => setAttachments(event.target.files || [])}
              />

              <div className="small text-muted mt-2">
                Upload supporting files along with the submission.
              </div>
            </div>
          </div>

          {Array.isArray(task.employeeAttachments) && task.employeeAttachments.length > 0 && (
            <div className="mt-3">
              <div className="fw-semibold mb-2">Submitted Attachments</div>
              <ul className="list-group">
                {task.employeeAttachments.map((file, index) => (
                  <li className="list-group-item" key={`${file.fileName}-${index}`}>
                    <a
                      href={`${uploadBaseUrl}/uploads/${file.fileName}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {file.originalName}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canSubmit && (
            <div className="d-flex justify-content-end mt-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitTask}
                disabled={saving}
              >
                {saving ? "Submitting..." : "Submit Checklist Task"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Approval Workflow</h5>
            {canDecide && <span className="badge bg-warning text-dark">Approval Pending</span>}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>Level</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Acted At</th>
                </tr>
              </thead>
              <tbody>
                {task.approvalSteps?.map((step) => (
                  <tr key={`${step.approvalLevel}-${step.approverEmployee?._id || step.approverEmployee}`}>
                    <td>{step.approvalLevel}</td>
                    <td>{formatEmployeeLabel(step.approverEmployee)}</td>
                    <td>{formatTaskStatus(step.status)}</td>
                    <td>{step.remarks || "-"}</td>
                    <td>{formatDateTime(step.actedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canDecide && (
            <div className="border rounded p-3 mt-3">
              <label className="form-label fw-semibold">Approval Remarks</label>
              <textarea
                className="form-control mb-3"
                rows="3"
                value={decisionRemarks}
                onChange={(event) => setDecisionRemarks(event.target.value)}
                placeholder="Add an approval or rejection note"
              />

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDecision("reject")}
                  disabled={decisionLoading}
                >
                  {decisionLoading ? "Saving..." : "Reject"}
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleDecision("approve")}
                  disabled={decisionLoading}
                >
                  {decisionLoading ? "Saving..." : "Approve"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="col-md-4">
      <div className="small text-muted">{label}</div>
      <div>{value || value === 0 ? value : "-"}</div>
    </div>
  );
}
