import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import {
  buildBrowserNotificationBody,
  formatEmployeeLabel,
  formatMonthlyDayLabel,
  formatNotificationStateLabel,
  formatPersonalTaskDate,
  formatPersonalTaskDateTime,
  formatPersonalTaskStatus,
  formatReminderRuleLabel,
  formatReminderTimeLabel,
  formatReminderTypeLabel,
  formatWeeklyDayLabel,
  getNotificationStateBadgeClass,
  getPersonalTaskStatusBadgeClass,
} from "../utils/personalTaskDisplay";

const initialFormState = {
  title: "",
  description: "",
  reminderDate: "",
  reminderTime: "",
  reminderType: "one_time",
  weeklyDayOfWeek: "",
  monthlyDayOfMonth: "",
};

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const weeklyReminderOptions = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

const monthlyReminderOptions = Array.from({ length: 31 }, (_, index) => {
  const dayValue = String(index + 1);

  return {
    value: dayValue,
    label: formatMonthlyDayLabel(dayValue),
  };
});

const getPermissionLabel = (value) => {
  if (value === "granted") return "Browser alerts on";
  if (value === "denied") return "Browser alerts blocked";
  if (value === "default") return "Browser alerts available";
  return "Browser alerts unsupported";
};

const getRecurrenceDefaultsFromDate = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return {
      weeklyDayOfWeek: "",
      monthlyDayOfMonth: "",
    };
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      weeklyDayOfWeek: "",
      monthlyDayOfMonth: "",
    };
  }

  return {
    weeklyDayOfWeek: String(parsedDate.getDay()),
    monthlyDayOfMonth: String(parsedDate.getDate()),
  };
};

const getViewerTaskLabel = (task) => {
  const relationship = String(task?.viewerRelationship || "").trim().toLowerCase();

  if (relationship === "creator") return "Shared by you";
  if (relationship === "assignee") return "Assigned to you";
  return "Own task";
};

export default function OwnTasks() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = getUser();
  const isEmployee = String(user?.role || "").trim().toLowerCase() === "employee";
  const attachmentInputRef = useRef(null);
  const loadTasksRef = useRef(async () => {});
  const loadTaskDetailRef = useRef(async () => {});

  const [form, setForm] = useState(initialFormState);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState("");
  const [shareableEmployees, setShareableEmployees] = useState([]);
  const [shareEmployeeSearch, setShareEmployeeSearch] = useState("");
  const [shareModalTask, setShareModalTask] = useState(null);
  const [shareListLoading, setShareListLoading] = useState(false);
  const [sharingTaskId, setSharingTaskId] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported"
  );
  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );

  const selectedTaskFromList = useMemo(
    () => rows.find((row) => String(row._id) === String(id || "")) || null,
    [id, rows]
  );
  const taskDetail = selectedTask || selectedTaskFromList;
  const taskAttachmentUrl = useMemo(() => {
    if (!taskDetail?.attachment) return "";
    return `${uploadBaseUrl}/uploads/${encodeURIComponent(taskDetail.attachment)}`;
  }, [taskDetail?.attachment, uploadBaseUrl]);
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;
  const dueCount = rows.filter((row) => row.notificationState === "due").length;
  const upcomingCount = rows.filter((row) => row.notificationState === "upcoming").length;
  const sharedByMeCount = rows.filter((row) => row.viewerRelationship === "creator").length;
  const assignedToMeCount = rows.filter((row) => row.viewerRelationship === "assignee").length;
  const hasFilters = Boolean(search.trim() || statusFilter);
  const ownTaskStats = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: rows.length,
        meta: "Own and shared reminders",
        accentClass: "own-tasks-stat-card--primary",
      },
      {
        label: "Pending Focus",
        value: pendingCount,
        meta: "Still waiting for action",
        accentClass: "own-tasks-stat-card--warning",
      },
      {
        label: "Completed",
        value: completedCount,
        meta: "Closed reminders",
        accentClass: "own-tasks-stat-card--success",
      },
      {
        label: "Due Now",
        value: dueCount,
        meta: "Need attention first",
        accentClass: "own-tasks-stat-card--danger",
      },
      {
        label: "Upcoming",
        value: upcomingCount,
        meta: "Scheduled next reminders",
        accentClass: "own-tasks-stat-card--accent",
      },
      {
        label: "Shared by You",
        value: sharedByMeCount,
        meta: `${assignedToMeCount} currently assigned to you`,
        accentClass: "own-tasks-stat-card--neutral",
      },
    ],
    [
      rows.length,
      pendingCount,
      completedCount,
      dueCount,
      upcomingCount,
      sharedByMeCount,
      assignedToMeCount,
    ]
  );
  const activeFilterPills = [
    search.trim() ? `Search: ${search.trim()}` : "",
    statusFilter ? `Status: ${formatPersonalTaskStatus(statusFilter)}` : "",
  ].filter(Boolean);
  const showWeeklySelector = form.reminderType === "weekly";
  const showMonthlySelector = form.reminderType === "monthly";
  const visibleShareableEmployees = useMemo(() => {
    const normalizedSearch = String(shareEmployeeSearch || "").trim().toLowerCase();

    return (Array.isArray(shareableEmployees) ? shareableEmployees : []).filter((employee) => {
      if (!normalizedSearch) return true;

      return [employee.employeeCode, employee.employeeName, employee.displayName, employee.email]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [shareEmployeeSearch, shareableEmployees]);

  useEffect(() => {
    void loadTasksRef.current();
  }, [search, statusFilter]);

  useEffect(() => {
    if (!id) {
      setSelectedTask(null);
      return;
    }

    void loadTaskDetailRef.current(id);
  }, [id]);

  useEffect(() => {
    return () => {
      if (attachmentPreview.startsWith("blob:")) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  const loadTasks = async () => {
    setLoading(true);

    try {
      const response = await api.get("/personal-tasks", {
        params: {
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });

      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Personal task list load failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const syncTaskInState = (task) => {
    if (!task?._id) return;

    setRows((currentValue) => {
      const hasExistingTask = currentValue.some(
        (row) => String(row._id) === String(task._id)
      );

      if (!hasExistingTask) {
        return [task, ...currentValue];
      }

      return currentValue.map((row) =>
        String(row._id) === String(task._id) ? task : row
      );
    });

    if (String(id || "") === String(task._id)) {
      setSelectedTask(task);
    }
  };

  const markReminderRead = async (taskId) => {
    try {
      const response = await api.post(`/personal-tasks/${taskId}/read`);
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }
    } catch (err) {
      console.error("Failed to mark reminder as read:", err);
    }
  };

  const loadTaskDetail = async (taskId) => {
    setDetailLoading(true);

    try {
      const response = await api.get(`/personal-tasks/${taskId}`);
      const nextTask = response.data || null;

      setSelectedTask(nextTask);

      if (nextTask?.hasUnreadNotification) {
        await markReminderRead(taskId);
      } else if (nextTask?._id) {
        syncTaskInState(nextTask);
      }
    } catch (err) {
      console.error("Personal task detail load failed:", err);

      if (err.response?.status === 404) {
        navigate("/own-tasks", { replace: true });
      }
    } finally {
      setDetailLoading(false);
    }
  };

  loadTasksRef.current = loadTasks;
  loadTaskDetailRef.current = loadTaskDetail;

  const loadShareableEmployees = async () => {
    setShareListLoading(true);

    try {
      const response = await api.get("/personal-tasks/shareable-employees");
      setShareableEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Shareable employees load failed:", err);
      setShareableEmployees([]);
      alert(err.response?.data?.message || "Failed to load employees");
    } finally {
      setShareListLoading(false);
    }
  };

  const openShareModal = async (task) => {
    if (!task?.canShare || task.status === "completed") {
      return;
    }

    setShareModalTask(task);
    setShareEmployeeSearch("");

    if (!shareableEmployees.length) {
      await loadShareableEmployees();
    }
  };

  const closeShareModal = () => {
    if (sharingTaskId) return;

    setShareModalTask(null);
    setShareEmployeeSearch("");
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((currentValue) => {
      const nextValue = {
        ...currentValue,
        [name]: value,
      };

      if (name === "reminderDate") {
        const derivedValues = getRecurrenceDefaultsFromDate(value);

        if (currentValue.reminderType === "weekly" && !currentValue.weeklyDayOfWeek) {
          nextValue.weeklyDayOfWeek = derivedValues.weeklyDayOfWeek;
        }

        if (currentValue.reminderType === "monthly" && !currentValue.monthlyDayOfMonth) {
          nextValue.monthlyDayOfMonth = derivedValues.monthlyDayOfMonth;
        }
      }

      if (name === "reminderType") {
        const derivedValues = getRecurrenceDefaultsFromDate(currentValue.reminderDate);

        if (value === "weekly") {
          nextValue.weeklyDayOfWeek =
            currentValue.weeklyDayOfWeek || derivedValues.weeklyDayOfWeek;
        } else {
          nextValue.weeklyDayOfWeek = "";
        }

        if (value === "monthly") {
          nextValue.monthlyDayOfMonth =
            currentValue.monthlyDayOfMonth || derivedValues.monthlyDayOfMonth;
        } else {
          nextValue.monthlyDayOfMonth = "";
        }
      }

      return nextValue;
    });
  };

  const clearAttachmentSelection = () => {
    setAttachmentFile(null);
    setAttachmentPreview((currentValue) => {
      if (currentValue.startsWith("blob:")) {
        URL.revokeObjectURL(currentValue);
      }
      return "";
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const resetCreateForm = () => {
    setForm(initialFormState);
    clearAttachmentSelection();
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;

    setAttachmentFile(file);
    setAttachmentPreview((currentValue) => {
      if (currentValue.startsWith("blob:")) {
        URL.revokeObjectURL(currentValue);
      }

      return file ? URL.createObjectURL(file) : "";
    });
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const data = new FormData();

      data.append("title", form.title);
      data.append("description", form.description);
      data.append("date", form.reminderDate);
      data.append("time", form.reminderTime);
      data.append("reminderType", form.reminderType);

      if (form.reminderType === "weekly" && form.weeklyDayOfWeek) {
        data.append("weeklyDayOfWeek", form.weeklyDayOfWeek);
      }

      if (form.reminderType === "monthly" && form.monthlyDayOfMonth) {
        data.append("monthlyDayOfMonth", form.monthlyDayOfMonth);
      }

      if (attachmentFile instanceof File) {
        data.append("attachment", attachmentFile);
      }

      const response = await api.post("/personal-tasks", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const createdTask = response.data?.task;

      resetCreateForm();
      setSearch("");
      setStatusFilter("");

      if (createdTask?._id) {
        syncTaskInState(createdTask);
        navigate(`/own-tasks/${createdTask._id}`);
      }

      await loadTasks();

      if (
        notificationPermission === "default" &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        const permission = await window.Notification.requestPermission();
        setNotificationPermission(permission);
      }
    } catch (err) {
      console.error("Personal task create failed:", err);
      alert(err.response?.data?.message || "Failed to create personal reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleShareTask = async (task, assignedEmployeeId) => {
    if (!task?._id || !assignedEmployeeId) return;

    setSharingTaskId(String(task._id));

    try {
      const response = await api.post(`/personal-tasks/${task._id}/share`, {
        assignedEmployeeId,
      });
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }

      closeShareModal();
      await loadTasks();
    } catch (err) {
      console.error("Personal task share failed:", err);
      alert(err.response?.data?.message || "Failed to share personal reminder");
    } finally {
      setSharingTaskId("");
    }
  };

  const handleCompleteTask = async (taskId) => {
    setCompletingTaskId(String(taskId));

    try {
      const response = await api.patch(`/personal-tasks/${taskId}/complete`);
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }

      await loadTasks();
    } catch (err) {
      console.error("Personal task completion failed:", err);
      alert(err.response?.data?.message || "Failed to complete personal reminder");
    } finally {
      setCompletingTaskId("");
    }
  };

  const requestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        const previewTask = taskDetail || rows.find((row) => row.notificationState === "due") || rows[0];
        if (previewTask) {
          new window.Notification(previewTask.title || "Own Task Reminder", {
            body:
              buildBrowserNotificationBody(previewTask) ||
              "Your personal reminder notifications are now enabled.",
          });
        }
      }
    } catch (err) {
      console.error("Browser notification permission request failed:", err);
    }
  };

  if (!isEmployee) {
    return <Navigate to="/checklists" replace />;
  }

  return (
    <div className="container-fluid mt-4 mb-5 own-tasks-page">
      <div className="page-intro-card mb-4 own-tasks-hero">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">User Panel</div>
            <h3 className="mb-1">Own & Shared Tasks</h3>
            <div className="page-subtitle">
              Create reminders for yourself, or share a task with another employee. These
              tasks do not use marks, approvals, or checklist workflow.
            </div>

            {activeFilterPills.length ? (
              <div className="own-tasks-filter-pills mt-3">
                {activeFilterPills.map((pill) => (
                  <span key={pill} className="own-tasks-filter-pill">
                    {pill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="form-help mt-3">
                Build reminders, monitor due work, and jump into any shared task from one place.
              </div>
            )}
          </div>

          <div className="d-flex flex-wrap gap-2 align-items-start own-tasks-hero__actions">
            <span className="summary-chip summary-chip--neutral">
              {getPermissionLabel(notificationPermission)}
            </span>
            {notificationPermission !== "granted" && notificationPermission !== "unsupported" ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={requestBrowserNotifications}
              >
                Enable Browser Alerts
              </button>
            ) : null}
          </div>
        </div>

        <div className="own-tasks-stats mt-4">
          {ownTaskStats.map((stat) => (
            <div key={stat.label} className={`own-tasks-stat-card ${stat.accentClass}`}>
              <div className="own-tasks-stat-card__label">{stat.label}</div>
              <div className="own-tasks-stat-card__value">{stat.value}</div>
              <div className="own-tasks-stat-card__meta">{stat.meta}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-5">
          <div className="soft-card h-100 own-tasks-panel own-tasks-panel--create">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h5 className="mb-1">Create Own Task</h5>
                <div className="form-help">
                  Add a task for yourself first, then use Sharing Employee to assign it when needed.
                </div>
              </div>

              <span className="badge bg-info-subtle text-info-emphasis border">
                Shareable
              </span>
            </div>

            <form className="d-flex flex-column gap-3 own-tasks-form" onSubmit={handleCreateTask}>
              <div>
                <label className="form-label">Title</label>
                <input
                  className="form-control"
                  name="title"
                  value={form.title}
                  onChange={handleFieldChange}
                  placeholder="Enter reminder title"
                  required
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  rows="4"
                  value={form.description}
                  onChange={handleFieldChange}
                  placeholder="Add details for this reminder"
                />
              </div>

              <div>
                <label className="form-label">Attach Image</label>
                <input
                  ref={attachmentInputRef}
                  className="form-control"
                  type="file"
                  name="attachment"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleAttachmentChange}
                />
                <div className="form-help mt-1">
                  Optional. Attach one image related to this task or reminder.
                </div>

                {attachmentPreview ? (
                  <div className="mt-3 own-tasks-upload-preview">
                    <img
                      src={attachmentPreview}
                      alt="Own task attachment preview"
                      className="own-tasks-upload-preview__image"
                    />
                    <div className="small text-muted">Attachment preview ready for this task.</div>
                  </div>
                ) : null}
              </div>

              <div className="row g-3 own-tasks-form-grid">
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input
                    className="form-control"
                    type="date"
                    name="reminderDate"
                    value={form.reminderDate}
                    onChange={handleFieldChange}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Time</label>
                  <input
                    className="form-control"
                    type="time"
                    name="reminderTime"
                    value={form.reminderTime}
                    onChange={handleFieldChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Reminder Type</label>
                <select
                  className="form-select"
                  name="reminderType"
                  value={form.reminderType}
                  onChange={handleFieldChange}
                >
                  <option value="one_time">One-time</option>
                  <option value="daily">Recurring Daily</option>
                  <option value="weekly">Recurring Weekly</option>
                  <option value="monthly">Recurring Monthly</option>
                </select>
              </div>

              {showWeeklySelector ? (
                <div>
                  <label className="form-label">Which Day of Week</label>
                  <select
                    className="form-select"
                    name="weeklyDayOfWeek"
                    value={form.weeklyDayOfWeek}
                    onChange={handleFieldChange}
                    required
                  >
                    <option value="">Select weekday</option>
                    {weeklyReminderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {showMonthlySelector ? (
                <div>
                  <label className="form-label">Which Day of Month</label>
                  <select
                    className="form-select"
                    name="monthlyDayOfMonth"
                    value={form.monthlyDayOfMonth}
                    onChange={handleFieldChange}
                    required
                  >
                    <option value="">Select day of month</option>
                    {monthlyReminderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="d-flex flex-wrap gap-2">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Creating..." : "Create Own Task"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={resetCreateForm}
                  disabled={saving}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="soft-card h-100 own-tasks-panel own-tasks-panel--detail">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h5 className="mb-1">Task Details</h5>
                <div className="form-help">
                  Open a task from the list or notification bell to review sharing, reminders, and completion.
                </div>
              </div>

              {id ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => navigate("/own-tasks")}
                >
                  Close
                </button>
              ) : null}
            </div>

            {detailLoading ? (
              <div className="empty-state py-4 own-tasks-detail-empty">
                Loading reminder details...
              </div>
            ) : taskDetail ? (
              <div className="d-flex flex-column gap-3">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 own-tasks-detail-header">
                  <div>
                    <h4 className="mb-1">{taskDetail.title || "-"}</h4>
                    <div className="text-muted">
                      {taskDetail.description || "No description added for this reminder."}
                    </div>
                    <div className="small text-muted mt-2">
                      Shared by: {formatEmployeeLabel(taskDetail.creator)}
                    </div>
                    <div className="small text-muted">
                      Assigned to: {formatEmployeeLabel(taskDetail.assignedEmployee)}
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 own-tasks-detail-badges">
                    <span className="badge text-bg-light">{getViewerTaskLabel(taskDetail)}</span>
                    <span className={`badge ${getPersonalTaskStatusBadgeClass(taskDetail.status)}`}>
                      {formatPersonalTaskStatus(taskDetail.status)}
                    </span>
                    <span
                      className={`badge ${getNotificationStateBadgeClass(
                        taskDetail.notificationState
                      )}`}
                    >
                      {formatNotificationStateLabel(taskDetail.notificationState)}
                    </span>
                  </div>
                </div>

                {taskAttachmentUrl ? (
                  <div className="own-tasks-detail-attachment">
                    <div className="small text-muted mb-2">Attached Image</div>
                    <a
                      href={taskAttachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="d-inline-block own-tasks-detail-attachment__link"
                    >
                      <img
                        src={taskAttachmentUrl}
                        alt={taskDetail.title || "Own task attachment"}
                        className="own-tasks-detail-attachment__image"
                      />
                    </a>
                  </div>
                ) : null}

                <div className="row g-3 own-tasks-detail-grid">
                  <DetailField label="Reminder Date" value={formatPersonalTaskDate(taskDetail.scheduledAt)} />
                  <DetailField
                    label="Reminder Time"
                    value={formatReminderTimeLabel(taskDetail.reminderTime)}
                  />
                  <DetailField
                    label="Reminder Type"
                    value={formatReminderTypeLabel(taskDetail.reminderType)}
                  />
                  <DetailField
                    label="Shared By"
                    value={formatEmployeeLabel(taskDetail.creator)}
                  />
                  <DetailField
                    label="Assigned To"
                    value={formatEmployeeLabel(taskDetail.assignedEmployee)}
                  />
                  <DetailField
                    label="Repeat Rule"
                    value={formatReminderRuleLabel(taskDetail)}
                  />
                  {taskDetail.reminderType === "weekly" ? (
                    <DetailField
                      label="Weekly On"
                      value={formatWeeklyDayLabel(taskDetail.weeklyDayOfWeek)}
                    />
                  ) : null}
                  {taskDetail.reminderType === "monthly" ? (
                    <DetailField
                      label="Monthly On"
                      value={formatMonthlyDayLabel(taskDetail.monthlyDayOfMonth)}
                    />
                  ) : null}
                  <DetailField
                    label="Created"
                    value={formatPersonalTaskDateTime(taskDetail.createdAt)}
                  />
                  <DetailField
                    label="Shared At"
                    value={formatPersonalTaskDateTime(taskDetail.sharedAt)}
                  />
                  <DetailField
                    label="Next Reminder"
                    value={formatPersonalTaskDateTime(taskDetail.nextReminderAt)}
                  />
                  <DetailField
                    label="Last Triggered"
                    value={formatPersonalTaskDateTime(taskDetail.lastTriggeredAt)}
                  />
                  <DetailField
                    label="Completed At"
                    value={formatPersonalTaskDateTime(taskDetail.completedAt)}
                  />
                  <DetailField
                    label="Completed By"
                    value={formatEmployeeLabel(taskDetail.completedBy)}
                  />
                  <DetailField
                    label="Notification State"
                    value={formatNotificationStateLabel(taskDetail.notificationState)}
                  />
                </div>

                <div className="d-flex flex-wrap gap-2 own-tasks-detail-actions">
                  {taskDetail.canShare && taskDetail.status !== "completed" ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => {
                        void openShareModal(taskDetail);
                      }}
                      disabled={String(sharingTaskId) === String(taskDetail._id)}
                    >
                      Sharing Employee
                    </button>
                  ) : null}

                  {taskDetail.canComplete || taskDetail.status === "completed" ? (
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => handleCompleteTask(taskDetail._id)}
                      disabled={
                        taskDetail.status === "completed" ||
                        !taskDetail.canComplete ||
                        String(completingTaskId) === String(taskDetail._id)
                      }
                    >
                      {String(completingTaskId) === String(taskDetail._id)
                        ? "Updating..."
                        : taskDetail.status === "completed"
                        ? "Completed"
                        : "Mark Completed"}
                    </button>
                  ) : null}

                  {taskDetail.hasUnreadNotification ? (
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={() => markReminderRead(taskDetail._id)}
                    >
                      Mark Notification Read
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-state py-5 own-tasks-detail-empty">
                No task selected. Use the list below or the bell icon in the navbar to open one.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="filter-card mb-4 own-tasks-filter-card">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Own & Shared Task List</h6>
            <div className="form-help">
              Review tasks you created and tasks assigned to you, then filter for pending or completed work.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-8">
            <input
              className="form-control"
              placeholder="Search by title or description"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All tasks</option>
              <option value="pending">Pending tasks</option>
              <option value="completed">Completed tasks</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell own-tasks-table-shell">
        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0 own-tasks-table">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Reminder</th>
                <th>Type</th>
                <th>Notification</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    Loading tasks...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    No tasks found
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const isSelected = String(row._id) === String(id || "");

                  return (
                    <tr
                      key={row._id}
                      className={`own-task-row${isSelected ? " own-task-row--selected" : ""}${
                        row.notificationState === "due" ? " own-task-row--due" : ""
                      }`}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <div className="own-tasks-title-cell">
                          <div className="fw-semibold">{row.title || "-"}</div>
                          <div className="small text-muted">
                            {row.description || "No description added"}
                          </div>
                          <div className="d-flex flex-wrap gap-2 mt-2">
                            <span className="badge text-bg-light">{getViewerTaskLabel(row)}</span>
                            {row.isSharedTask ? (
                              <span className="small text-muted">
                                Shared by: {formatEmployeeLabel(row.creator)}
                              </span>
                            ) : null}
                          </div>
                          <div className="small text-muted mt-1">
                            Assigned to: {formatEmployeeLabel(row.assignedEmployee)}
                          </div>
                          {row.status === "completed" ? (
                            <div className="small text-muted">
                              Completed: {formatPersonalTaskDateTime(row.completedAt)}
                            </div>
                          ) : null}
                          {row.attachment ? (
                            <div className="small text-primary mt-1">Image attached</div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div>{formatPersonalTaskDateTime(row.scheduledAt)}</div>
                        <div className="small text-muted">
                          Next: {formatPersonalTaskDateTime(row.nextReminderAt)}
                        </div>
                      </td>
                      <td>{formatReminderRuleLabel(row)}</td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span
                            className={`badge align-self-start ${getNotificationStateBadgeClass(
                              row.notificationState
                            )}`}
                          >
                            {formatNotificationStateLabel(row.notificationState)}
                          </span>
                          <span className="small text-muted">
                            {formatPersonalTaskDateTime(row.notificationAt)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getPersonalTaskStatusBadgeClass(row.status)}`}>
                          {formatPersonalTaskStatus(row.status)}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2 own-tasks-row-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => navigate(`/own-tasks/${row._id}`)}
                          >
                            View
                          </button>
                          {row.canShare && row.status !== "completed" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => {
                                void openShareModal(row);
                              }}
                              disabled={String(sharingTaskId) === String(row._id)}
                            >
                              Sharing Employee
                            </button>
                          ) : null}
                          {row.canComplete || row.status === "completed" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => handleCompleteTask(row._id)}
                              disabled={
                                row.status === "completed" ||
                                !row.canComplete ||
                                String(completingTaskId) === String(row._id)
                              }
                            >
                              {String(completingTaskId) === String(row._id)
                                ? "Updating..."
                                : row.status === "completed"
                                ? "Completed"
                                : "Complete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {shareModalTask ? (
        <TaskShareModal
          task={shareModalTask}
          shareSearch={shareEmployeeSearch}
          setShareSearch={setShareEmployeeSearch}
          employees={visibleShareableEmployees}
          loading={shareListLoading}
          sharing={String(sharingTaskId) === String(shareModalTask._id)}
          onClose={closeShareModal}
          onSelectEmployee={(employeeId) => {
            void handleShareTask(shareModalTask, employeeId);
          }}
        />
      ) : null}
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="own-tasks-detail-field">
        <div className="small text-muted mb-1 own-tasks-detail-field__label">{label}</div>
        <div className="fw-semibold own-tasks-detail-field__value">{value || "-"}</div>
      </div>
    </div>
  );
}

function TaskShareModal({
  task,
  shareSearch,
  setShareSearch,
  employees,
  loading,
  sharing,
  onClose,
  onSelectEmployee,
}) {
  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable own-tasks-share-modal">
        <div className="modal-content own-tasks-share-modal__content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">Sharing Employee</h5>
              <div className="small text-muted">
                Select the employee who should receive "{task?.title || "this task"}".
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={sharing} />
          </div>

          <div className="modal-body d-flex flex-column gap-3 own-tasks-share-modal__body">
            <input
              className="form-control own-tasks-share-modal__search"
              placeholder="Search employee by code, name, or email"
              value={shareSearch}
              onChange={(event) => setShareSearch(event.target.value)}
              disabled={loading || sharing}
            />

            {loading ? (
              <div className="text-muted">Loading employees...</div>
            ) : employees.length ? (
              <div className="d-flex flex-column gap-2">
                {employees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    className="notification-item own-tasks-share-modal__employee"
                    onClick={() => onSelectEmployee(employee._id)}
                    disabled={sharing}
                  >
                    <div className="fw-semibold text-dark">
                      {formatEmployeeLabel(employee)}
                    </div>
                    <div className="small text-muted text-start">
                      {employee.email || "Employee"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-muted">No employees found for sharing.</div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={sharing}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
