import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  buildBrowserNotificationBody,
  formatPersonalTaskDateTime,
} from "../utils/personalTaskDisplay";
import {
  buildChatMentionNotificationBody,
  formatChatDateTime,
  getChatRoutePath,
} from "../utils/chatDisplay";
import { clearPostLoginWelcomeSession } from "../utils/postLoginWelcome";

const emptyReminderState = {
  counts: {
    due: 0,
    upcoming: 0,
    total: 0,
  },
  due: [],
  upcoming: [],
};

const emptyChatNotificationState = {
  counts: {
    mentions: 0,
    unreadMessages: 0,
  },
  mentions: [],
};

const emptyFeedbackNotificationState = {
  counts: {
    unread: 0,
  },
  rows: [],
};

const emptyRequestNotificationState = {
  counts: {
    unread: 0,
  },
  rows: [],
};

const buildNavLinkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;
const buildDropdownItemClass = ({ isActive }) =>
  `dropdown-item${isActive ? " active" : ""}`;
const truncateNotificationText = (value, maxLength = 140) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) return "";
  if (normalizedValue.length <= maxLength) return normalizedValue;

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2" />
      <path
        fillRule="evenodd"
        d="M8 1.918a1 1 0 0 0-.9.55A5 5 0 0 0 3 7c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7a5 5 0 0 0-4.1-4.532A1 1 0 0 0 8 1.918M14 14H2c1-1 1.5-5.2 1.5-7a4.5 4.5 0 0 1 9 0c0 1.8.5 6 1.5 7"
      />
    </svg>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const notificationMenuRef = useRef(null);
  const shownBrowserNotificationKeysRef = useRef(new Set());
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const hasRestrictedChecklistAccess =
    !isAdmin &&
    !isEmployee &&
    (role === "user" || Boolean(user?.checklistMasterAccess));
  const userName = user?.name || user?.employeeName || "Signed in";
  const userDisplayId = user?.email || user?.employeeCode || "";
  const employeeMenuPath = user?.id ? `/view/${user.id}` : "/employees";
  const homePath = hasRestrictedChecklistAccess ? "/checklists" : "/dashboard-1";

  const [menuOpen, setMenuOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reminderNotificationData, setReminderNotificationData] =
    useState(emptyReminderState);
  const [chatNotificationData, setChatNotificationData] = useState(
    emptyChatNotificationState
  );
  const [feedbackNotificationData, setFeedbackNotificationData] = useState(
    emptyFeedbackNotificationState
  );
  const [requestNotificationData, setRequestNotificationData] = useState(
    emptyRequestNotificationState
  );
  const [notificationLoading, setNotificationLoading] = useState(false);

  const totalNotificationCount =
    isAdmin
      ? Number(feedbackNotificationData.counts.unread || 0) +
        Number(requestNotificationData.counts.unread || 0)
      : hasRestrictedChecklistAccess
      ? Number(requestNotificationData.counts.unread || 0)
      : Number(reminderNotificationData.counts.total || 0) +
        Number(chatNotificationData.counts.mentions || 0);

  const dashboardLinks = useMemo(() => {
    if (hasRestrictedChecklistAccess) {
      return [];
    }

    return [
      { to: "/dashboard-1", label: "Overview 1" },
      { to: "/dashboard-2", label: "Overview 2" },
    ];
  }, [hasRestrictedChecklistAccess]);

  const navLinks = useMemo(() => {
    if (hasRestrictedChecklistAccess) {
      return [
        { to: "/checklists", label: "Checklist Masters" },
        { to: "/masters/checklist-transfer", label: "Checklist Transfer" },
      ];
    }

    const baseLinks = [
      {
        to: isAdmin ? "/employees" : employeeMenuPath,
        label: isAdmin ? "Employees" : "My Profile",
      },
      {
        to: "/checklists",
        label: isAdmin ? "Checklist Masters" : "My Checklist Tasks",
      },
      { to: "/chat", label: "Site Chat" },
      { to: "/department-chat", label: "Department Chat" },
    ];

    if (!isAdmin) {
      baseLinks.splice(4, 0, {
        to: "/own-tasks",
        label: "Own Tasks",
      });
    }

    return baseLinks;
  }, [employeeMenuPath, hasRestrictedChecklistAccess, isAdmin]);

  useEffect(() => {
    setMenuOpen(false);
    setDashboardOpen(false);
    setMastersOpen(false);
    setReportsOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isEmployee && !isAdmin && !hasRestrictedChecklistAccess) {
      setReminderNotificationData(emptyReminderState);
      setChatNotificationData(emptyChatNotificationState);
      setFeedbackNotificationData(emptyFeedbackNotificationState);
      setRequestNotificationData(emptyRequestNotificationState);
      setNotificationLoading(false);
      return undefined;
    }

    let active = true;

    const fetchNotifications = async (showLoader = false) => {
      if (showLoader) {
        setNotificationLoading(true);
      }

      try {
        if (isAdmin) {
          const [feedbackResponse, requestResponse] = await Promise.all([
            api.get("/feedback/notifications"),
            api.get("/checklists/admin-requests/notifications"),
          ]);

          if (!active) return;

          setFeedbackNotificationData({
            counts:
              feedbackResponse.data?.counts || emptyFeedbackNotificationState.counts,
            rows: Array.isArray(feedbackResponse.data?.rows)
              ? feedbackResponse.data.rows
              : [],
          });
          setRequestNotificationData({
            counts:
              requestResponse.data?.counts || emptyRequestNotificationState.counts,
            rows: Array.isArray(requestResponse.data?.rows)
              ? requestResponse.data.rows
              : [],
          });
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          return;
        }

        if (hasRestrictedChecklistAccess) {
          const requestResponse = await api.get("/checklists/admin-requests/notifications");

          if (!active) return;

          setRequestNotificationData({
            counts:
              requestResponse.data?.counts || emptyRequestNotificationState.counts,
            rows: Array.isArray(requestResponse.data?.rows)
              ? requestResponse.data.rows
              : [],
          });
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          setFeedbackNotificationData(emptyFeedbackNotificationState);
          return;
        }

        const [taskResponse, siteChatResponse, departmentChatResponse] = await Promise.all([
          api.get("/personal-tasks/notifications"),
          api.get("/chat/notifications"),
          api.get("/department-chat/notifications"),
        ]);

        if (!active) return;

        const siteChatCounts = siteChatResponse.data?.counts || emptyChatNotificationState.counts;
        const departmentChatCounts =
          departmentChatResponse.data?.counts || emptyChatNotificationState.counts;
        const combinedMentions = [
          ...(Array.isArray(siteChatResponse.data?.mentions)
            ? siteChatResponse.data.mentions
            : []),
          ...(Array.isArray(departmentChatResponse.data?.mentions)
            ? departmentChatResponse.data.mentions
            : []),
        ].sort(
          (left, right) =>
            new Date(right?.createdAt || 0).getTime() -
            new Date(left?.createdAt || 0).getTime()
        );

        setReminderNotificationData({
          counts: taskResponse.data?.counts || emptyReminderState.counts,
          due: Array.isArray(taskResponse.data?.due) ? taskResponse.data.due : [],
          upcoming: Array.isArray(taskResponse.data?.upcoming)
            ? taskResponse.data.upcoming
            : [],
        });
        setChatNotificationData({
          counts: {
            mentions:
              Number(siteChatCounts.mentions || 0) +
              Number(departmentChatCounts.mentions || 0),
            unreadMessages:
              Number(siteChatCounts.unreadMessages || 0) +
              Number(departmentChatCounts.unreadMessages || 0),
          },
          mentions: combinedMentions,
        });
        setFeedbackNotificationData(emptyFeedbackNotificationState);
        setRequestNotificationData(emptyRequestNotificationState);
      } catch (err) {
        console.error("Notification load failed:", err);

        if (active) {
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          setFeedbackNotificationData(emptyFeedbackNotificationState);
          setRequestNotificationData(emptyRequestNotificationState);
        }
      } finally {
        if (active && showLoader) {
          setNotificationLoading(false);
        }
      }
    };

    void fetchNotifications(true);

    const intervalId = setInterval(() => {
      void fetchNotifications(false);
    }, 30000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [hasRestrictedChecklistAccess, isAdmin, isEmployee]);

  useEffect(() => {
    if (!isEmployee) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;

    const dueItems = Array.isArray(reminderNotificationData.due)
      ? reminderNotificationData.due
      : [];

    dueItems.forEach((task) => {
      const notificationKey = `task:${task._id}:${task.notificationAt || task.lastTriggeredAt || ""}`;

      if (!task.notificationAt || shownBrowserNotificationKeysRef.current.has(notificationKey)) {
        return;
      }

      shownBrowserNotificationKeysRef.current.add(notificationKey);

      const notification = new window.Notification(task.title || "Own Task Reminder", {
        body: buildBrowserNotificationBody(task) || "A personal reminder is due now.",
        tag: notificationKey,
      });

      notification.onclick = () => {
        window.focus();
        void api.post(`/personal-tasks/${task._id}/read`).catch((err) => {
          console.error("Failed to mark browser reminder notification as read:", err);
        });
        navigate(`/own-tasks/${task._id}`);
        notification.close();
      };
    });
  }, [isEmployee, navigate, reminderNotificationData.due]);

  useEffect(() => {
    if (!isEmployee) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;

    const mentionItems = Array.isArray(chatNotificationData.mentions)
      ? chatNotificationData.mentions
      : [];

    mentionItems.forEach((item) => {
      const notificationKey = `chat:${item.chatType || "site"}:${item._id}`;

      if (shownBrowserNotificationKeysRef.current.has(notificationKey)) {
        return;
      }

      shownBrowserNotificationKeysRef.current.add(notificationKey);

      const notification = new window.Notification(
        item.senderName ? `${item.senderName} mentioned you` : "New chat mention",
        {
          body:
            buildChatMentionNotificationBody(item) ||
            "You were mentioned in a chat.",
          tag: notificationKey,
        }
      );

      notification.onclick = () => {
        window.focus();
        const params = new URLSearchParams();
        params.set("group", item.groupId);
        params.set("message", item._id);
        navigate(`${getChatRoutePath(item)}?${params.toString()}`);
        notification.close();
      };
    });
  }, [chatNotificationData.mentions, isEmployee, navigate]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [notificationsOpen]);

  const logout = () => {
    clearPostLoginWelcomeSession();
    localStorage.clear();
    navigate("/login");
  };

  const openReminderNotification = async (task) => {
    setNotificationsOpen(false);

    try {
      await api.post(`/personal-tasks/${task._id}/read`);
    } catch (err) {
      console.error("Reminder read update failed:", err);
    }

    navigate(`/own-tasks/${task._id}`);
  };

  const openChatNotification = (item) => {
    setNotificationsOpen(false);

    const params = new URLSearchParams();
    params.set("group", item.groupId);
    params.set("message", item._id);

    navigate(`${getChatRoutePath(item)}?${params.toString()}`);
  };

  const openFeedbackNotification = async (item) => {
    try {
      await api.post(`/feedback/${item._id}/read`);

      setFeedbackNotificationData((currentState) => ({
        counts: {
          unread: Math.max(0, Number(currentState.counts.unread || 0) - 1),
        },
        rows: currentState.rows.filter((row) => row._id !== item._id),
      }));
    } catch (err) {
      console.error("Feedback notification read update failed:", err);
    }
  };

  const openRequestNotification = async (item) => {
    setNotificationsOpen(false);

    try {
      await api.post(`/checklists/admin-requests/notifications/${item._id}/read`);

      setRequestNotificationData((currentState) => ({
        counts: {
          unread: Math.max(0, Number(currentState.counts.unread || 0) - 1),
        },
        rows: currentState.rows.filter((row) => row._id !== item._id),
      }));
    } catch (err) {
      console.error("Checklist notification read update failed:", err);
    }

    navigate(item.routePath || (isAdmin ? "/checklists/admin-approvals" : "/checklists"));
  };

  const markAllFeedbackNotificationsRead = async () => {
    try {
      await api.post("/feedback/notifications/read-all");
      setFeedbackNotificationData(emptyFeedbackNotificationState);
    } catch (err) {
      console.error("Mark all feedback notifications read failed:", err);
    }
  };

  const markAllChecklistRequestNotificationsRead = async () => {
    try {
      await api.post("/checklists/admin-requests/notifications/read-all");
      setRequestNotificationData(emptyRequestNotificationState);
    } catch (err) {
      console.error("Mark all checklist notifications read failed:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    if (isAdmin) {
      await Promise.all([
        markAllFeedbackNotificationsRead(),
        markAllChecklistRequestNotificationsRead(),
      ]);
      return;
    }

    if (hasRestrictedChecklistAccess) {
      await markAllChecklistRequestNotificationsRead();
    }
  };

  const renderReminderGroup = (title, rows) => {
    if (!rows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">{title}</div>
        <div className="d-flex flex-column gap-2">
          {rows.map((task) => (
            <button
              type="button"
              key={`${task._id}-${task.notificationAt || task.nextReminderAt || ""}`}
              className="notification-item"
              onClick={() => openReminderNotification(task)}
            >
              <div className="fw-semibold text-dark">{task.title || "Own Task"}</div>
              <div className="small text-muted text-start">
                {buildBrowserNotificationBody(task) ||
                  task.description ||
                  "Open to view full reminder details."}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(task.notificationAt || task.nextReminderAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderChatMentions = () => {
    const mentionRows = Array.isArray(chatNotificationData.mentions)
      ? chatNotificationData.mentions
      : [];

    if (!mentionRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Chat Mentions</div>
        <div className="d-flex flex-column gap-2">
          {mentionRows.map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openChatNotification(item)}
            >
              <div className="fw-semibold text-dark">
                {item.senderName || "Chat"}
              </div>
              <div className="small text-muted text-start">
                {buildChatMentionNotificationBody(item) ||
                  "Open the chat to view the mention."}
              </div>
              <div className="small text-primary text-start">
                {formatChatDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderFeedbackNotifications = () => {
    const feedbackRows = Array.isArray(feedbackNotificationData.rows)
      ? feedbackNotificationData.rows
      : [];

    if (!feedbackRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Employee Feedback</div>
        <div className="d-flex flex-column gap-2">
          {feedbackRows.map((item) => {
            const sourceLabel = [item.pageTitle, item.pagePath].filter(Boolean).join(" | ");

            return (
              <button
                type="button"
                key={item._id}
                className="notification-item"
                onClick={() => openFeedbackNotification(item)}
              >
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="fw-semibold text-dark">
                    {item.submittedByName || item.name || "Employee Feedback"}
                  </div>
                  <span className="badge text-bg-light border text-dark">
                    {item.category || "Feedback"}
                  </span>
                </div>
                <div className="small text-muted text-start">
                  {item.email || "No email provided"}
                </div>
                {sourceLabel ? (
                  <div className="small text-muted text-start">{sourceLabel}</div>
                ) : null}
                <div className="small text-muted text-start">
                  Satisfaction: {Number(item.satisfaction || 0)}/5
                </div>
                <div className="small text-dark text-start">
                  {truncateNotificationText(
                    item.message || "Open to review the submitted feedback."
                  )}
                </div>
                <div className="small text-primary text-start">
                  {formatPersonalTaskDateTime(item.createdAt)}
                </div>
                <div className="small text-muted text-start">
                  Click to mark this feedback notification as read.
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderChecklistRequestNotifications = () => {
    const requestRows = Array.isArray(requestNotificationData.rows)
      ? requestNotificationData.rows
      : [];

    if (!requestRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">
          {isAdmin ? "Checklist Requests" : "Checklist Updates"}
        </div>
        <div className="d-flex flex-column gap-2">
          {requestRows.map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openRequestNotification(item)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="fw-semibold text-dark">
                  {item.title || item.moduleName || "Checklist Notification"}
                </div>
                <span className="badge text-bg-light border text-dark">
                  {item.actionLabel || item.moduleName || "Checklist"}
                </span>
              </div>
              <div className="small text-muted text-start">
                {item.message || "Open to view the latest checklist request update."}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark px-3 px-lg-4 app-navbar">
      <NavLink className="navbar-brand fw-semibold" to={homePath}>
        Check List Workspace
      </NavLink>

      <button
        className="navbar-toggler"
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Toggle navigation"
      >
        <span className="navbar-toggler-icon" />
      </button>

      <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
          {dashboardLinks.length ? (
            <li className="nav-item dropdown">
              <button
                type="button"
                className={`nav-link dropdown-toggle border-0 bg-transparent ${
                  location.pathname.startsWith("/dashboard-1") ||
                  location.pathname.startsWith("/dashboard-2") ||
                  location.pathname === "/dashboard"
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setDashboardOpen((prev) => !prev);
                  setReportsOpen(false);
                  setMastersOpen(false);
                }}
                aria-expanded={dashboardOpen}
              >
                Dashboard
              </button>

              <ul className={`dropdown-menu ${dashboardOpen ? "show" : ""}`}>
                {dashboardLinks.map((link) => (
                  <li key={link.to}>
                    <NavLink className={buildDropdownItemClass} to={link.to}>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}

          {navLinks.map((link) => (
            <li className="nav-item" key={link.to}>
              <NavLink className={buildNavLinkClass} to={link.to}>
                {link.label}
              </NavLink>
            </li>
          ))}

          {isEmployee ? (
            <li className="nav-item">
              <NavLink className={buildNavLinkClass} to="/checklists/approvals">
                Approval Inbox
              </NavLink>
            </li>
          ) : null}

          {isAdmin ? (
            <>
              <li className="nav-item dropdown">
                <button
                  type="button"
                  className={`nav-link dropdown-toggle border-0 bg-transparent ${
                    location.pathname.startsWith("/reports") ? "active" : ""
                  }`}
                  onClick={() => {
                    setReportsOpen((prev) => !prev);
                    setDashboardOpen(false);
                    setMastersOpen(false);
                  }}
                  aria-expanded={reportsOpen}
                >
                  Reports
                </button>
                <ul className={`dropdown-menu ${reportsOpen ? "show" : ""}`}>
                  <li>
                    <NavLink className={buildDropdownItemClass} to="/reports/checklists">
                      Checklist Report
                    </NavLink>
                  </li>
                </ul>
              </li>

              <li className="nav-item">
                <NavLink className={buildNavLinkClass} to="/checklists/admin-approvals">
                  Admin Approvals
                </NavLink>
              </li>

              <li className="nav-item">
                <NavLink className={buildNavLinkClass} to="/users">
                  Users
                </NavLink>
              </li>

              <li className="nav-item dropdown">
                <button
                  type="button"
                  className={`nav-link dropdown-toggle border-0 bg-transparent ${
                    location.pathname.startsWith("/masters") ? "active" : ""
                  }`}
                  onClick={() => {
                    setMastersOpen((prev) => !prev);
                    setDashboardOpen(false);
                    setReportsOpen(false);
                  }}
                  aria-expanded={mastersOpen}
                >
                  Masters
                </button>

                <ul className={`dropdown-menu ${mastersOpen ? "show" : ""}`}>
                  <li>
                    <NavLink className={buildDropdownItemClass} to="/masters/companies">
                      Companies
                    </NavLink>
                  </li>
                  <li>
                    <NavLink className={buildDropdownItemClass} to="/masters/departments">
                      Departments
                    </NavLink>
                  </li>
                  <li>
                    <NavLink className={buildDropdownItemClass} to="/masters/designations">
                      Designations
                    </NavLink>
                  </li>
                  <li>
                    <NavLink className={buildDropdownItemClass} to="/masters/sites">
                      Sites
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      className={buildDropdownItemClass}
                      to="/masters/checklist-transfer"
                    >
                      Checklist Transfer
                    </NavLink>
                  </li>
                </ul>
              </li>
            </>
          ) : null}
        </ul>

        <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 app-navbar__actions">
          {isEmployee || isAdmin || hasRestrictedChecklistAccess ? (
            <div className="position-relative" ref={notificationMenuRef}>
              <button
                type="button"
                className="notification-toggle"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
              >
                <BellIcon />
                {totalNotificationCount ? (
                  <span className="notification-toggle__badge">{totalNotificationCount}</span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="notification-menu">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <div className="fw-semibold text-dark">Notifications</div>
                    {isEmployee ? (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none p-0"
                          onClick={() => navigate("/chat")}
                        >
                          Open Site Chat
                        </button>
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none p-0"
                          onClick={() => navigate("/department-chat")}
                        >
                          Open Department Chat
                        </button>
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-decoration-none p-0"
                          onClick={() => navigate("/own-tasks")}
                        >
                          Open Own Tasks
                        </button>
                      </div>
                    ) : null}
                    {isAdmin || hasRestrictedChecklistAccess ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={markAllNotificationsRead}
                        disabled={!totalNotificationCount}
                      >
                        Mark All Read
                      </button>
                    ) : null}
                  </div>

                  {notificationLoading ? (
                    <div className="small text-muted">Loading notifications...</div>
                  ) : totalNotificationCount ? (
                    <div className="d-flex flex-column gap-3">
                      {isAdmin ? (
                        <>
                          {renderChecklistRequestNotifications()}
                          {renderFeedbackNotifications()}
                        </>
                      ) : hasRestrictedChecklistAccess ? (
                        renderChecklistRequestNotifications()
                      ) : (
                        <>
                          {renderChatMentions()}
                          {renderReminderGroup("Due Now", reminderNotificationData.due)}
                          {renderReminderGroup("Upcoming", reminderNotificationData.upcoming)}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="small text-muted">
                      {isAdmin
                        ? "No new checklist requests or employee feedback notifications right now."
                        : hasRestrictedChecklistAccess
                        ? "No new checklist approval updates right now."
                        : "No chat mentions or reminder alerts right now."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="text-end small app-navbar__session">
            <div className="fw-semibold">{userName}</div>
            <div className="app-navbar__session-meta">
              {userDisplayId || "Current session"}
            </div>
          </div>

          <span className="badge text-uppercase px-3 py-2 app-navbar__role-badge">
            {isAdmin
              ? "Admin"
              : isEmployee
              ? "Employee"
              : role === "user" || user?.checklistMasterAccess
              ? "Checklist User"
              : "User"}
          </span>

          <button onClick={logout} className="btn btn-danger btn-sm">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
