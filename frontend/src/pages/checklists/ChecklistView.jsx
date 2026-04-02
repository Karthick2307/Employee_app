import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  formatApprovalLabel,
  formatChecklistDependencyLabel,
  formatChecklistScoreLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTimeLabel,
  formatMarkValue,
  formatTargetDayCountLabel,
  getChecklistMarkConfig,
  getPriorityBadgeClass,
} from "../../utils/checklistDisplay";

const getChecklistSiteName = (site) => String(site?.name || "").trim();

export default function ChecklistView() {
  const { id } = useParams();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserRole = String(currentUser?.role || "").trim().toLowerCase();
  const isAdminChecklistUser = currentUserRole === "admin";
  const canEditChecklist =
    currentUserRole === "admin" ||
    currentUserRole === "user" ||
    Boolean(currentUser?.checklistMasterAccess);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState(null);
  const markConfig = getChecklistMarkConfig(checklist || {});

  useEffect(() => {
    const loadChecklist = async () => {
      setLoading(true);

      try {
        const response = await api.get(`/checklists/${id}`);
        setChecklist(response.data || null);
      } catch (err) {
        console.error("Checklist master load failed:", err);
        setChecklist(null);
      } finally {
        setLoading(false);
      }
    };

    void loadChecklist();
  }, [id]);

  if (loading) {
    return <div className="container mt-4">Loading checklist master...</div>;
  }

  if (!checklist) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">Checklist master not found.</div>
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
          <h3 className="mb-1">Checklist Master Details</h3>
          <div className="text-muted">
            Review the recurring schedule, employee mapping, and approval flow.
          </div>
        </div>

        <div className="d-flex gap-2">
          <Link className="btn btn-outline-secondary" to="/checklists">
            Back
          </Link>
          {canEditChecklist ? (
            <Link className="btn btn-warning" to={`/checklists/edit/${checklist._id}`}>
              {isAdminChecklistUser ? "Edit" : "Request Edit"}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <h5 className="mb-3">Master Information</h5>

          <div className="row g-3">
            <Info label="Checklist Number" value={checklist.checklistNumber} />
            <Info label="Checklist Name" value={checklist.checklistName} />
            <Info
              label="Task Scoring"
              value={markConfig.enableMark ? "Enabled" : "Disabled"}
            />
            <Info label="Score Setup" value={formatChecklistScoreLabel(checklist)} />
            <Info
              label="Base Mark"
              value={markConfig.enableMark ? formatMarkValue(markConfig.baseMark) : "Not enabled"}
            />
            <Info
              label="Delay Penalty / Day"
              value={
                markConfig.enableMark
                  ? formatMarkValue(markConfig.delayPenaltyPerDay)
                  : "Not enabled"
              }
            />
            <Info
              label="Advance Bonus / Day"
              value={
                markConfig.enableMark
                  ? formatMarkValue(markConfig.advanceBonusPerDay)
                  : "Not enabled"
              }
            />
            <Info
              label="Checklist Source Site"
              value={getChecklistSiteName(checklist.checklistSourceSite) || "-"}
            />
            <Info label="Assigned Employee" value={formatEmployeeLabel(checklist.assignedToEmployee)} />
            <Info
              label="Dependent Task"
              value={checklist.isDependentTask ? "Yes" : "No"}
            />
            <Info
              label="Previous Task Number"
              value={
                checklist.isDependentTask ? formatChecklistDependencyLabel(checklist) : "-"
              }
            />
            <Info
              label="Target Day Count"
              value={
                checklist.isDependentTask
                  ? formatTargetDayCountLabel(checklist.targetDayCount)
                  : "-"
              }
            />
            <Info
              label="Priority"
              value={
                <span className={`badge ${getPriorityBadgeClass(checklist)}`}>
                  {formatPriorityLabel(checklist)}
                </span>
              }
            />
            <Info label="Schedule Type" value={formatScheduleLabel(checklist)} />
            <Info label="Start Date" value={formatDateTime(checklist.startDate)} />
            <Info label="Start Task Time" value={formatTimeLabel(checklist.scheduleTime)} />
            <Info label="End Date" value={formatDateTime(checklist.endDate)} />
            <Info label="End Time" value={formatTimeLabel(checklist.endTime)} />
            <Info label="Next Occurrence" value={formatDateTime(checklist.nextOccurrenceAt)} />
            <Info
              label="Assigned Site"
              value={getChecklistSiteName(checklist.employeeAssignedSite) || "-"}
            />
            <Info label="Approval Hierarchy" value={checklist.approvalHierarchy} />
            <Info label="Approver Mapping" value={formatApprovalLabel(checklist)} />
            <Info
              label="Status"
              value={
                <span className={`badge ${checklist.status ? "bg-success" : "bg-secondary"}`}>
                  {checklist.status ? "Active" : "Inactive"}
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <h5 className="mb-3">Task Related Questions</h5>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Guidance</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(checklist.checklistItems) && checklist.checklistItems.length > 0 ? (
                  checklist.checklistItems.map((item, index) => (
                    <tr key={item._id || index}>
                      <td>{index + 1}</td>
                      <td>{item.label}</td>
                      <td>{item.detail || "-"}</td>
                      <td>{item.isRequired !== false ? "Yes" : "No"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No task related questions configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h5 className="mb-3">Approval Workflow</h5>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>Level</th>
                  <th>Approver</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(checklist.approvals) && checklist.approvals.length > 0 ? (
                  checklist.approvals.map((row) => (
                    <tr key={`${row.approvalLevel}-${row.approvalEmployee?._id || row.approvalEmployee}`}>
                      <td>{row.approvalLevel}</td>
                      <td>{formatEmployeeLabel(row.approvalEmployee)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="text-center">
                      Approval mapping not configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="col-md-6">
      <div className="small text-muted">{label}</div>
      <div>{value || value === 0 ? value : "-"}</div>
    </div>
  );
}
