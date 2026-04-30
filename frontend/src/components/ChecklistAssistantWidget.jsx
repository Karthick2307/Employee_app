import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const getSessionUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const buildRoleLabelFromSession = () => {
  const role = String(getSessionUser()?.role || "").trim().toLowerCase();

  if (role === "admin") return "Admin";
  if (role === "employee") return "Employee";
  if (role === "user" || getSessionUser()?.checklistMasterAccess) return "Checklist User";
  return "User";
};

const buildFallbackQuickActions = () => {
  const role = String(getSessionUser()?.role || "").trim().toLowerCase();

  if (role === "employee") {
    return [
      { id: "pending", label: "Pending Tasks", command: "Show my pending tasks" },
      { id: "today", label: "Today Tasks", command: "Show today tasks" },
      { id: "completed", label: "Completed Tasks", command: "Show completed tasks" },
      { id: "approvals", label: "Pending Approvals", command: "Show pending approvals" },
      { id: "details", label: "Checklist Details", command: "Show checklist details" },
    ];
  }

  if (role === "admin") {
    return [
      { id: "today", label: "Today Tasks", command: "Show today tasks" },
      { id: "marks", label: "Employee Marks", command: "Show employee marks" },
      { id: "summary", label: "Site Summary", command: "Show site/department summary" },
      { id: "details", label: "Checklist Details", command: "Show checklist details" },
      { id: "transfer", label: "Transfer Details", command: "Show transfer details" },
    ];
  }

  return [
    { id: "today", label: "Today Tasks", command: "Show today tasks" },
    { id: "completed", label: "Completed Tasks", command: "Show completed tasks" },
    { id: "approvals", label: "Pending Approvals", command: "Show pending approvals" },
    { id: "details", label: "Checklist Details", command: "Show checklist details" },
    { id: "transfer", label: "Transfer Details", command: "Show transfer details" },
  ];
};

const buildWelcomeMessage = (roleLabel = buildRoleLabelFromSession()) => ({
  title: "Checklist Assistant",
  message: `Ask about tasks, approvals, marks, summaries, checklist details, or transfers for your ${roleLabel.toLowerCase()} workspace.`,
  stats: [{ label: "Role", value: roleLabel }],
  items: [],
  actions: [],
  emptyMessage: "Use a quick action below or type your own checklist question.",
});

const buildInitialMessages = (roleLabel = buildRoleLabelFromSession()) => [
  { id: "assistant-welcome", sender: "assistant", response: buildWelcomeMessage(roleLabel) },
];

const mapConversationsToMessages = (rows = []) =>
  rows.flatMap((row) => [
    {
      id: `user-${row._id}`,
      sender: "user",
      text: row.prompt || "",
      createdAt: row.createdAt || "",
    },
    {
      id: `assistant-${row._id}`,
      sender: "assistant",
      response: row.response || {},
      createdAt: row.createdAt || "",
    },
  ]);

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3a5 5 0 0 0-4.546 7.083l-.806 2.42a.5.5 0 0 0 .632.632l2.42-.806A5 5 0 1 0 8 3m0-1a6 6 0 0 1 5.77 7.643A6 6 0 0 1 2.357 13.77L.975 14.23a1 1 0 0 1-1.265-1.265l.46-1.382A6 6 0 1 1 8 2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1 10.5a.5.5 0 0 1 .5.5V14h3a.5.5 0 0 1 0 1H1a1 1 0 0 1-1-1v-3a.5.5 0 0 1 .5-.5m14-10a1 1 0 0 1 1 1v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1zM10.146 5.854a.5.5 0 0 1 0-.708L14.293 1H12.5a.5.5 0 0 1 0-1H15a1 1 0 0 1 1 1v2.5a.5.5 0 0 1-1 0V1.707l-4.146 4.147a.5.5 0 0 1-.708 0M5.854 10.146a.5.5 0 0 1 0 .708L1.707 15H3.5a.5.5 0 0 1 0 1H1a1 1 0 0 1-1-1v-2.5a.5.5 0 0 1 1 0v1.793l4.146-4.147a.5.5 0 0 1 .708 0" />
    </svg>
  );
}

function CompressIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6.854 1.146a.5.5 0 0 1 0 .708L2.707 6H4.5a.5.5 0 0 1 0 1H2a1 1 0 0 1-1-1V3.5a.5.5 0 0 1 1 0v1.793l4.146-4.147a.5.5 0 0 1 .708 0m2.292 0a.5.5 0 0 1 .708 0L14 5.293V3.5a.5.5 0 0 1 1 0V6a1 1 0 0 1-1 1h-2.5a.5.5 0 0 1 0-1h1.793L9.146 1.854a.5.5 0 0 1 0-.708M1.146 9.146a.5.5 0 0 1 .708 0L6 13.293V11.5a.5.5 0 0 1 1 0V14a1 1 0 0 1-1 1H3.5a.5.5 0 0 1 0-1h1.793L1.146 9.854a.5.5 0 0 1 0-.708m13.708 0a.5.5 0 0 1 0 .708L10.707 14H12.5a.5.5 0 0 1 0 1H10a1 1 0 0 1-1-1v-2.5a.5.5 0 0 1 1 0v1.793l4.146-4.147a.5.5 0 0 1 .708 0" />
    </svg>
  );
}

export default function ChecklistAssistantWidget() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [navbarOffset, setNavbarOffset] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState(() => buildInitialMessages());
  const [quickActions, setQuickActions] = useState(() => buildFallbackQuickActions());
  const [roleLabel, setRoleLabel] = useState(() => buildRoleLabelFromSession());
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const visibleQuickActions = useMemo(() => quickActions.slice(0, 5), [quickActions]);

  useEffect(() => {
    if (!isOpen || hasLoaded) return;

    let active = true;

    const loadHistory = async () => {
      setLoadingHistory(true);
      setErrorMessage("");
      setStatusMessage("");

      try {
        const response = await api.get("/chatbot/history");
        if (!active) return;

        const nextRoleLabel = response.data?.roleLabel || buildRoleLabelFromSession();
        const nextQuickActions = Array.isArray(response.data?.quickActions)
          ? response.data.quickActions
          : buildFallbackQuickActions();
        const historyMessages = mapConversationsToMessages(response.data?.conversations);

        setRoleLabel(nextRoleLabel);
        setQuickActions(nextQuickActions);
        setMessages(
          historyMessages.length
            ? historyMessages
            : buildInitialMessages(nextRoleLabel)
        );
      } catch (err) {
        if (!active) return;

        setErrorMessage(err.response?.data?.message || "Failed to load assistant history");
        setQuickActions(buildFallbackQuickActions());
        setMessages(buildInitialMessages());
      } finally {
        if (active) {
          setHasLoaded(true);
          setLoadingHistory(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [hasLoaded, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isOpen, messages, submitting]);

  useEffect(() => {
    const shouldLockPage = isOpen && isFullscreen;

    document.body.classList.toggle("assistant-widget-fullscreen-open", shouldLockPage);

    return () => {
      document.body.classList.remove("assistant-widget-fullscreen-open");
    };
  }, [isFullscreen, isOpen]);

  useEffect(() => {
    if (!isOpen || !isFullscreen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen, isOpen]);

  useEffect(() => {
    if (!isOpen || !isFullscreen) {
      setNavbarOffset(0);
      return undefined;
    }

    const getVisibleNavbarHeight = () => {
      const navbar = document.querySelector(".app-navbar");
      if (!navbar) return 0;

      const rect = navbar.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      return Math.ceil(visibleHeight);
    };

    const updateNavbarOffset = () => {
      setNavbarOffset(getVisibleNavbarHeight());
    };

    updateNavbarOffset();

    let resizeObserver;
    const navbar = document.querySelector(".app-navbar");

    if (navbar && typeof window.ResizeObserver === "function") {
      resizeObserver = new window.ResizeObserver(() => {
        updateNavbarOffset();
      });
      resizeObserver.observe(navbar);
    }

    window.addEventListener("resize", updateNavbarOffset);
    window.addEventListener("scroll", updateNavbarOffset, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateNavbarOffset);
      window.removeEventListener("scroll", updateNavbarOffset, true);
    };
  }, [isFullscreen, isOpen]);

  const openRoute = (route) => {
    if (!route) return;
    setIsOpen(false);
    setIsFullscreen(false);
    navigate(route);
  };

  const closeWidget = () => {
    setIsOpen(false);
    setIsFullscreen(false);
  };

  const openWidget = () => {
    setIsOpen(true);
    setIsFullscreen(true);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((currentValue) => !currentValue);
  };

  const appendAssistantMessage = (response) => {
    setMessages((currentValue) => [
      ...currentValue,
      {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        response,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const submitPrompt = async (promptValue) => {
    const prompt = String(promptValue || "").trim();
    if (!prompt || submitting || clearingHistory) return;

    setErrorMessage("");
    setStatusMessage("");
    setHasLoaded(true);
    setInputValue("");
    setMessages((currentValue) => [
      ...currentValue,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: prompt,
        createdAt: new Date().toISOString(),
      },
    ]);
    setSubmitting(true);

    try {
      const response = await api.post("/chatbot/query", { message: prompt });
      const nextRoleLabel = response.data?.roleLabel || roleLabel;
      const nextQuickActions = Array.isArray(response.data?.quickActions)
        ? response.data.quickActions
        : buildFallbackQuickActions();

      setRoleLabel(nextRoleLabel);
      setQuickActions(nextQuickActions);
      appendAssistantMessage(response.data?.response || buildWelcomeMessage(nextRoleLabel));
    } catch (err) {
      const nextMessage =
        err.response?.data?.message || "The assistant could not process that request right now.";
      setErrorMessage(nextMessage);
      appendAssistantMessage({
        title: "Assistant Unavailable",
        message: nextMessage,
        stats: [],
        items: [],
        actions: [],
        emptyMessage: "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const clearHistory = async () => {
    if (submitting || loadingHistory || clearingHistory) return;

    const confirmed = window.confirm(
      "Clear old assistant chats? This removes the saved chat history for your account."
    );
    if (!confirmed) return;

    setClearingHistory(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const response = await api.delete("/chatbot/history");
      const nextRoleLabel = response.data?.roleLabel || roleLabel;
      const nextQuickActions = Array.isArray(response.data?.quickActions)
        ? response.data.quickActions
        : buildFallbackQuickActions();

      setRoleLabel(nextRoleLabel);
      setQuickActions(nextQuickActions);
      setInputValue("");
      setHasLoaded(true);
      setMessages(buildInitialMessages(nextRoleLabel));
      setStatusMessage(response.data?.message || "Assistant chat history cleared");
    } catch (err) {
      setErrorMessage(err.response?.data?.message || "Failed to clear assistant history");
    } finally {
      setClearingHistory(false);
    }
  };

  const renderAssistantResponse = (response = {}) => {
    const stats = Array.isArray(response.stats) ? response.stats : [];
    const items = Array.isArray(response.items) ? response.items : [];
    const actions = Array.isArray(response.actions) ? response.actions : [];

    return (
      <div className="assistant-widget__response">
        {response.title ? <div className="assistant-widget__response-title">{response.title}</div> : null}
        {response.message ? <div className="assistant-widget__response-text">{response.message}</div> : null}

        {stats.length ? (
          <div className="assistant-widget__stats">
            {stats.map((stat) => (
              <div key={`${stat.label}-${stat.value}`} className="assistant-widget__stat">
                <span className="assistant-widget__stat-label">{stat.label}</span>
                <span className="assistant-widget__stat-value">{stat.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        {items.length ? (
          <div className="assistant-widget__cards">
            {items.map((item) => (
              <div key={item.id || item.title} className="assistant-widget__card">
                {item.label ? <div className="assistant-widget__card-label">{item.label}</div> : null}
                <div className="assistant-widget__card-title">{item.title}</div>
                {item.subtitle ? <div className="assistant-widget__card-subtitle">{item.subtitle}</div> : null}
                {item.meta ? <div className="assistant-widget__card-meta">{item.meta}</div> : null}
                {item.detail ? <div className="assistant-widget__card-detail">{item.detail}</div> : null}
                {item.route ? (
                  <button
                    type="button"
                    className="assistant-widget__link"
                    onClick={() => openRoute(item.route)}
                  >
                    {item.routeLabel || "Open"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : response.emptyMessage ? (
          <div className="assistant-widget__empty">{response.emptyMessage}</div>
        ) : null}

        {actions.length ? (
          <div className="assistant-widget__response-actions">
            {actions.map((action) => (
              <button
                type="button"
                key={`${action.label}-${action.route}`}
                className="assistant-widget__secondary-btn"
                onClick={() => openRoute(action.route)}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div
      className={`assistant-widget${isOpen ? " assistant-widget--open" : ""}${
        isFullscreen ? " assistant-widget--fullscreen" : ""
      }`}
      style={{ "--assistant-navbar-offset": `${navbarOffset}px` }}
    >
      {isOpen ? (
        <div className="assistant-widget__panel shadow-lg">
          <div className="assistant-widget__header">
            <div>
              <div className="assistant-widget__eyebrow">Smart Assistant</div>
              <div className="assistant-widget__title">Checklist Assistant</div>
              <div className="assistant-widget__subtitle">{roleLabel} workspace helper</div>
            </div>

            <div className="assistant-widget__header-actions">
              <button
                type="button"
                className="assistant-widget__clear-btn"
                onClick={() => void clearHistory()}
                disabled={submitting || loadingHistory || clearingHistory}
              >
                {clearingHistory ? "Clearing..." : "Clear chat"}
              </button>

              <button
                type="button"
                className="assistant-widget__icon-btn"
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen
                    ? "Exit full screen checklist assistant"
                    : "Open full screen checklist assistant"
                }
                title={isFullscreen ? "Exit full screen" : "Full screen"}
              >
                {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
              </button>

              <button
                type="button"
                className="assistant-widget__icon-btn"
                onClick={closeWidget}
                aria-label="Close checklist assistant"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="assistant-widget__quick-actions">
            {visibleQuickActions.map((action) => (
              <button
                type="button"
                key={action.id || action.command}
                className="assistant-widget__quick-action"
                onClick={() => submitPrompt(action.command)}
                disabled={submitting || clearingHistory}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="assistant-widget__messages">
            {loadingHistory ? <div className="assistant-widget__status">Loading assistant history...</div> : null}
            {statusMessage ? <div className="assistant-widget__status">{statusMessage}</div> : null}
            {errorMessage ? <div className="assistant-widget__status assistant-widget__status--error">{errorMessage}</div> : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`assistant-widget__message assistant-widget__message--${message.sender}`}
              >
                {message.sender === "user" ? (
                  <div className="assistant-widget__bubble">{message.text}</div>
                ) : (
                  <div className="assistant-widget__bubble assistant-widget__bubble--assistant">
                    {renderAssistantResponse(message.response)}
                  </div>
                )}
              </div>
            ))}

            {submitting ? (
              <div className="assistant-widget__message assistant-widget__message--assistant">
                <div className="assistant-widget__bubble assistant-widget__bubble--assistant">
                  <div className="assistant-widget__typing">Assistant is preparing an answer...</div>
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form
            className="assistant-widget__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPrompt(inputValue);
            }}
          >
            <textarea
              className="form-control assistant-widget__input"
              rows="2"
              placeholder="Ask about checklists, approvals, tasks, or transfers..."
              value={inputValue}
              disabled={clearingHistory}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitPrompt(inputValue);
                }
              }}
            />

            <div className="assistant-widget__composer-row">
              <div className="assistant-widget__hint">Example: Show checklist details Safety</div>
              <button
                type="submit"
                className="btn btn-primary assistant-widget__send"
                disabled={submitting || clearingHistory || !inputValue.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="assistant-widget__toggle"
        onClick={openWidget}
        aria-label="Open checklist assistant"
      >
        <ChatIcon />
        <span>Ask Assistant</span>
      </button>
    </div>
  );
}
