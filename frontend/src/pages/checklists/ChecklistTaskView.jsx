import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalTypeLabel,
  formatChecklistDependencyLabel,
  formatChecklistDependencyStatus,
  formatCurrentApproverLabel,
  formatChecklistTaskStatus,
  formatDateTime,
  formatEmployeeLabel,
  formatMarkAdjustment,
  formatMarkValue,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  formatTargetDayCountLabel,
  formatTimelinessLabel,
  formatTaskStatus,
  getTaskTargetDateTime,
  getApprovalTypeBadgeClass,
  getChecklistDependencyStatusBadgeClass,
  getTaskMarkSummary,
  getChecklistTaskStatusBadgeClass,
  getPriorityBadgeClass,
  getTimelinessBadgeClass,
  isNilChecklistTask,
} from "../../utils/checklistDisplay";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const normalizeTaskText = (value) => String(value || "").trim();

const getEmployeeTaskAnswer = (value) => {
  const answer = normalizeTaskText(
    value?.employeeAnswerRemark || value?.answer || value?.remarks
  );
  if (answer) return answer;
  return value?.verified ? "Completed" : "";
};

const getSuperiorTaskAnswer = (value) => normalizeTaskText(value?.superiorAnswerRemark);

const buildTaskStageSummary = (task) => {
  const normalizedStatus = String(task?.status || "").trim().toLowerCase();
  const isNilTaskFlow = isNilChecklistTask(task);
  const hasSubmission = Boolean(task?.submittedAt);
  const hasApprovalReview =
    hasSubmission ||
    ["approved", "nil_approved", "rejected"].includes(normalizedStatus);

  return [
    { label: "Assigned", active: true },
    { label: isNilTaskFlow ? "Nil Submitted" : "Submitted", active: hasSubmission },
    { label: isNilTaskFlow ? "Nil Under Approval" : "Under Approval", active: hasApprovalReview },
    {
      label: isNilTaskFlow ? "Nil Approved / Completed" : "Approved / Completed",
      active: ["approved", "nil_approved"].includes(normalizedStatus),
    },
  ];
};

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
  const isNilTaskFlow = isNilChecklistTask(task);
  const isWaitingOnDependency =
    String(task?.status || "").trim().toLowerCase() === "waiting_dependency";

  const canSubmit = isAssignedEmployee && task?.status === "open";
  const canDecide =
    isCurrentApprover && ["submitted", "nil_for_approval"].includes(String(task?.status || ""));
  const markSummary = getTaskMarkSummary(task || {});
  const taskStageSummary = buildTaskStageSummary(task);
  const requiredSuperiorRemarksComplete =
    !Array.isArray(task?.checklistItems) ||
    task.checklistItems.every((item) => {
      if (item?.isRequired === false) return true;

      const response =
        itemResponses.find(
          (row) =>
            String(row.checklistItemId) === String(item.checklistItemId || item._id)
        ) || {};

      return Boolean(
        normalizeTaskText(response.superiorAnswerRemark || item.superiorAnswerRemark)
      );
    });
  const pageDescription = canDecide
    ? isNilTaskFlow
      ? "Review the submitted questions and complete the Nil approval flow without applying any task mark."
      : "Review the submitted questions and enter your superior remark for each required question before approving or rejecting."
    : isWaitingOnDependency
    ? `This task is locked until ${formatChecklistDependencyLabel(task)} is completed.`
    : canSubmit
    ? "Review the assigned task, answer each question, and submit it for approval."
    : isAssignedEmployee
    ? "Review your submitted answers and track the approval progress."
    : "Review the task questions and the superior review details.";

  const loadTask = useCallback(async () => {
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
              employeeAnswerRemark: getEmployeeTaskAnswer(item),
              superiorAnswerRemark: getSuperiorTaskAnswer(item),
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
  }, [id]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  const updateItemResponse = (checklistItemId, key, value) => {
    setItemResponses((prev) =>
      prev.map((item) =>
        String(item.checklistItemId) === String(checklistItemId)
          ? { ...item, [key]: value }
          : item
      )
    );
  };

  const handleSubmitTask = async (submissionType = "normal") => {
    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("employeeRemarks", employeeRemarks);
      payload.append("submissionType", submissionType);
      payload.append(
        "itemResponses",
        JSON.stringify(
          itemResponses.map((item) => ({
            checklistItemId: item.checklistItemId,
            employeeAnswerRemark: item.employeeAnswerRemark,
            answer: item.employeeAnswerRemark,
          }))
        )
      );

      Array.from(attachments || []).forEach((file) => {
        payload.append("attachments", file);
      });

      await api.post(`/checklists/tasks/${id}/submit`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadTask();
      alert(
        submissionType === "nil"
          ? "Task submitted for nil approval successfully."
          : "Task answers submitted successfully."
      );
    } catch (err) {
      console.error("Checklist task submit failed:", err);
      alert(err.response?.data?.message || "Failed to submit task answers");
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
        itemResponses: itemResponses.map((item) => ({
          checklistItemId: item.checklistItemId,
          superiorAnswerRemark: item.superiorAnswerRemark,
        })),
      });

      await loadTask();
      const actionLabelMap = {
        approve: "approved",
        reject: "rejected",
        nil_approve: "nil approved",
      };
      alert(`Task answers ${actionLabelMap[action] || "updated"} successfully.`);
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
          <div className="text-muted">{pageDescription}</div>
        </div>

        <Link className="btn btn-outline-secondary" to="/checklists">
          Back
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          {isWaitingOnDependency ? (
            <div className="alert alert-warning mb-3">
              Waiting for Previous Task Completion. This checklist will unlock automatically after{" "}
              <span className="fw-semibold">{formatChecklistDependencyLabel(task)}</span> is completed.
            </div>
          ) : null}

          <div className="row g-3">
            <Info label="Task Number" value={task.taskNumber} />
            <Info label="Checklist Number" value={task.checklistNumber} />
            <Info label="Checklist Name" value={task.checklistName} />
            <Info label="Assigned Employee" value={formatEmployeeLabel(task.assignedEmployee)} />
            <Info label="Dependent Task" value={task.isDependentTask ? "Yes" : "No"} />
            <Info
              label="Previous Task"
              value={task.isDependentTask ? formatChecklistDependencyLabel(task) : "-"}
            />
            <Info
              label="Dependency Status"
              value={
                task.isDependentTask ? (
                  <span className={`badge ${getChecklistDependencyStatusBadgeClass(task)}`}>
                    {formatChecklistDependencyStatus(task)}
                  </span>
                ) : (
                  "No Dependency"
                )
              }
            />
            <Info
              label="Target Day Count"
              value={task.isDependentTask ? formatTargetDayCountLabel(task.targetDayCount) : "-"}
            />
            <Info
              label="Previous Task Completed At"
              value={formatDateTime(task.dependencyCompletedAt)}
            />
            <Info
              label="Target Date / Time"
              value={formatDateTime(getTaskTargetDateTime(task))}
            />
            <Info
              label="Auto Created From Dependency"
              value={task.autoCreatedFromDependency ? "Yes" : "No"}
            />
            <Info label="Unlocked At" value={formatDateTime(task.unlockedAt)} />
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
            <Info
              label="Approval Type"
              value={
                <span className={`badge ${getApprovalTypeBadgeClass(task)}`}>
                  {formatApprovalTypeLabel(task)}
                </span>
              }
            />
            <Info label="Current Approver" value={formatCurrentApproverLabel(task)} />
            <Info
              label="Time Status"
              value={
                <span
                  className={`badge ${getTimelinessBadgeClass(
                    task.submissionTimingStatus || task.timelinessStatus
                  )}`}
                >
                  {formatTimelinessLabel(
                    task.submissionTimingStatus || task.timelinessStatus
                  )}
                </span>
              }
            />
            <Info
              label="Status"
              value={
                <span className={`badge ${getChecklistTaskStatusBadgeClass(task.status)}`}>
                  {formatChecklistTaskStatus(task.status)}
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2">
            {taskStageSummary.map((stage) => (
              <span
                key={stage.label}
                className={`summary-chip${stage.active ? "" : " summary-chip--neutral"}`}
              >
                {stage.label}
              </span>
            ))}
            {String(task.status || "").trim().toLowerCase() === "rejected" ? (
              <span className="badge text-bg-danger">Rejected</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Task Score</h5>
            <span
              className={`badge ${
                markSummary.isNilApproval
                  ? "bg-info text-dark border"
                  : markSummary.enableMark
                  ? "bg-success-subtle text-success border"
                  : "bg-light text-dark border"
              }`}
            >
              {markSummary.isNilApproval
                ? "Nil Approval / No Mark"
                : markSummary.enableMark
                ? "Scored Task"
                : "No Scoring"}
            </span>
          </div>

          <div className="row g-3">
            <Info
              label="Base Mark"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.baseMark)
                  : "Not enabled"
              }
            />
            <Info
              label="Delay/Advance Days"
              value={formatTaskMarkDayLabel(task)}
            />
            <Info
              label="Adjustment"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? markSummary.adjustment !== null
                    ? formatMarkAdjustment(markSummary.adjustment)
                    : "Pending"
                  : "Not enabled"
              }
            />
            <Info
              label="Final Mark"
              value={formatTaskFinalMarkLabel(task)}
            />
            <Info
              label="Delay Penalty / Day"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.delayPenaltyPerDay)
                  : "Not enabled"
              }
            />
            <Info
              label="Advance Bonus / Day"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.advanceBonusPerDay)
                  : "Not enabled"
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Task Related Questions</h5>
            {canSubmit ? (
              <span className="badge bg-primary">Employee Answer Required</span>
            ) : canDecide ? (
              <span className="badge bg-warning text-dark">Superior Remark Required</span>
            ) : (
              <span className="badge bg-light text-dark border">Read Only</span>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Guidance</th>
                  <th style={{ width: "34%" }}>
                    {canDecide
                      ? "Superior Answer / Remark"
                      : isAssignedEmployee
                      ? canSubmit
                        ? "Answer / Remark"
                        : "Your Answer / Remark"
                      : "Superior Answer / Remark"}
                  </th>
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
                        {canSubmit ? (
                          <textarea
                            className="form-control"
                            rows="3"
                            value={response.employeeAnswerRemark || ""}
                            onChange={(event) =>
                              updateItemResponse(
                                item.checklistItemId || item._id,
                                "employeeAnswerRemark",
                                event.target.value
                              )
                            }
                            placeholder={
                              item.isRequired !== false
                                ? "Enter the required answer or remark"
                                : "Enter the answer or remark"
                            }
                          />
                        ) : canDecide ? (
                          <textarea
                            className="form-control"
                            rows="3"
                            value={response.superiorAnswerRemark || ""}
                            onChange={(event) =>
                              updateItemResponse(
                                item.checklistItemId || item._id,
                                "superiorAnswerRemark",
                                event.target.value
                              )
                            }
                            placeholder={
                              item.isRequired !== false
                                ? "Enter the required superior answer or remark"
                                : "Enter the superior answer or remark"
                            }
                          />
                        ) : isAssignedEmployee ? (
                          <div className="small text-dark">
                            {getEmployeeTaskAnswer(response) ||
                              getEmployeeTaskAnswer(item) ||
                              "No answer submitted."}
                          </div>
                        ) : (
                          <div className="small text-dark">
                            {getSuperiorTaskAnswer(response) ||
                              getSuperiorTaskAnswer(item) ||
                              "No superior remark submitted."}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row g-3 mt-1">
            {canSubmit || isAssignedEmployee ? (
              <div className={canSubmit ? "col-md-8" : "col-12"}>
                <label className="form-label fw-semibold">Submission Summary</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={employeeRemarks}
                  disabled={!canSubmit}
                  onChange={(event) => setEmployeeRemarks(event.target.value)}
                  placeholder="Add an overall note for the submitted answers"
                />
              </div>
            ) : null}

            {canSubmit ? (
              <div className="col-md-4">
                <label className="form-label fw-semibold">Attachments</label>
                <input
                  type="file"
                  multiple
                  className="form-control"
                  onChange={(event) => setAttachments(event.target.files || [])}
                />

                <div className="small text-muted mt-2">
                  Upload supporting files along with the submission.
                </div>
              </div>
            ) : null}
          </div>

          {Array.isArray(task.employeeAttachments) && task.employeeAttachments.length > 0 && (
            <div className="mt-3">
              <div className="fw-semibold mb-2">
                {canSubmit || isAssignedEmployee ? "Submitted Attachments" : "Employee Attachments"}
              </div>
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
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => handleSubmitTask("nil")}
                disabled={saving}
              >
                {saving ? "Submitting..." : "Nil For Approval"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSubmitTask("normal")}
                disabled={saving}
              >
                {saving ? "Submitting..." : "Submit For Approval"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Approval Workflow</h5>
            {canDecide && (
              <span
                className={`badge ${
                  isNilTaskFlow ? "bg-info text-dark" : "bg-warning text-dark"
                }`}
              >
                {isNilTaskFlow ? "Nil Approval Pending" : "Approval Pending"}
              </span>
            )}
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
              <div className="small text-muted mb-3">
                Enter the superior answer or remark for every required question to enable approval actions.
              </div>

              <label className="form-label fw-semibold">Approval Summary</label>
              <textarea
                className="form-control mb-3"
                rows="3"
                value={decisionRemarks}
                onChange={(event) => setDecisionRemarks(event.target.value)}
                placeholder="Add an approval or rejection summary if needed"
              />

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDecision("reject")}
                  disabled={decisionLoading || !requiredSuperiorRemarksComplete}
                >
                  {decisionLoading ? "Saving..." : "Reject"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-info"
                  onClick={() => handleDecision("nil_approve")}
                  disabled={decisionLoading || !requiredSuperiorRemarksComplete}
                >
                  {decisionLoading ? "Saving..." : "Nil Approve"}
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => handleDecision("approve")}
                  disabled={decisionLoading || !requiredSuperiorRemarksComplete || isNilTaskFlow}
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
