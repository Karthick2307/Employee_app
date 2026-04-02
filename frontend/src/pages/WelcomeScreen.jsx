import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import welcomeBackground from "../images/welcome.jpg";
import {
  dismissPostLoginWelcome,
  getPostLoginDestination,
  getPostLoginWelcomeSessionId,
  getStoredUser,
} from "../utils/postLoginWelcome";

const WELCOME_MESSAGES = [
  "Complete your tasks on time for better performance.",
  "On-time completion improves your score.",
  "Avoid delays to maintain your performance marks.",
  "Every completed task moves you forward.",
  "Stay updated with your checklist tasks.",
  "Let's start your tasks.",
];

const toSafeCount = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;
  return Math.round(parsedValue);
};

const buildSeedValue = (value) =>
  String(value || "").split("").reduce((total, character) => total + character.charCodeAt(0), 0);

const pickWelcomeMessages = (seedSource, count = 3) => {
  const availableMessages = [...WELCOME_MESSAGES];
  const selectedMessages = [];
  let seed = buildSeedValue(seedSource) || 17;

  while (availableMessages.length && selectedMessages.length < count) {
    const index = seed % availableMessages.length;
    selectedMessages.push(availableMessages.splice(index, 1)[0]);
    seed = seed * 31 + 7;
  }

  return selectedMessages;
};

function CountUpNumber({ value, duration = 900 }) {
  const targetValue = toSafeCount(value);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || targetValue <= 0) {
      return undefined;
    }

    let frameId = 0;
    let animationStart = 0;

    const animate = (timestamp) => {
      if (!animationStart) {
        animationStart = timestamp;
      }

      const progress = Math.min(1, (timestamp - animationStart) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;

      setDisplayValue(Math.round(targetValue * easedProgress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [duration, targetValue]);

  if (targetValue <= 0) {
    return <>{targetValue}</>;
  }

  return <>{displayValue}</>;
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const [summary, setSummary] = useState(() => ({
    userName: storedUser.name || "User",
    pendingTaskCount: 0,
    pendingChecklistCount: 0,
    pendingReminderCount: 0,
    isDepartmentSuperior: false,
    departmentPendingCount: 0,
  }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const loadWelcomeSummary = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await api.get("/dashboard/welcome-summary");
        if (!active) return;

        setSummary((currentValue) => ({
          ...currentValue,
          ...(response.data || {}),
          userName: response.data?.userName || currentValue.userName,
        }));
      } catch (err) {
        if (!active) return;

        setLoadError(
          err.response?.data?.message ||
            "Latest task counts could not be loaded, but you can still continue."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadWelcomeSummary();

    return () => {
      active = false;
    };
  }, []);

  const sessionSeed = getPostLoginWelcomeSessionId();
  const motivationalMessages = useMemo(
    () =>
      pickWelcomeMessages(
        `${sessionSeed}:${summary.userName}:${summary.pendingTaskCount}:${summary.departmentPendingCount}`
      ),
    [sessionSeed, summary.departmentPendingCount, summary.pendingTaskCount, summary.userName]
  );

  const personalPendingCount = toSafeCount(summary.pendingTaskCount);
  const checklistPendingCount = toSafeCount(summary.pendingChecklistCount);
  const reminderPendingCount = toSafeCount(summary.pendingReminderCount);
  const departmentPendingCount = toSafeCount(summary.departmentPendingCount);
  const showDepartmentSummary =
    Boolean(summary.isDepartmentSuperior) || departmentPendingCount > 0;
  const taskLabel = personalPendingCount === 1 ? "Task" : "Tasks";
  const focusStatusLabel = loading
    ? "Refreshing your task board"
    : personalPendingCount > 0
    ? "Time to focus"
    : "All tasks clear";
  const welcomeDescriptor = showDepartmentSummary
    ? "Lead your department schedule with clear visibility, better timing, and steady task completion."
    : "Stay on top of your checklist schedule and keep every task moving at the right time.";

  const handleContinue = () => {
    dismissPostLoginWelcome();
    navigate(getPostLoginDestination(storedUser), { replace: true });
  };

  return (
    <div className="welcome-shell">
      <div className="welcome-shell__media" aria-hidden="true">
        <img className="welcome-shell__photo" src={welcomeBackground} alt="" />
      </div>

      <div className="welcome-card">
        <div className="welcome-card__masthead">
          <div className="welcome-card__intro">
            <div className="welcome-card__eyebrow">Workspace Ready</div>
            <h1 className="welcome-card__title">Hi, {summary.userName || "User"}</h1>
            <div className="welcome-card__headline">Check Your Task Regularly</div>
            <p className="welcome-card__lead">{welcomeDescriptor}</p>
            <div className="welcome-card__countline">
              Pending Your Task Count:{" "}
              <span className="welcome-card__count">
                <CountUpNumber
                  key={`pending-countline-${personalPendingCount}`}
                  value={personalPendingCount}
                />
              </span>{" "}
              {taskLabel}
            </div>
          </div>

          <div className="welcome-spotlight">
            <div className="welcome-spotlight__hero">
              <div className="welcome-hourglass" aria-hidden="true">
                <span className="welcome-hourglass__cap welcome-hourglass__cap--top" />
                <span className="welcome-hourglass__cap welcome-hourglass__cap--bottom" />
                <span className="welcome-hourglass__frame welcome-hourglass__frame--left" />
                <span className="welcome-hourglass__frame welcome-hourglass__frame--right" />
                <span className="welcome-hourglass__glass welcome-hourglass__glass--top" />
                <span className="welcome-hourglass__glass welcome-hourglass__glass--bottom" />
                <span className="welcome-hourglass__sand welcome-hourglass__sand--top" />
                <span className="welcome-hourglass__stream" />
                <span className="welcome-hourglass__sand welcome-hourglass__sand--bottom" />
                <span className="welcome-hourglass__base" />
              </div>

              <div className="welcome-spotlight__summary">
                <div className="welcome-spotlight__eyebrow">Today's Focus</div>
                <div className="welcome-spotlight__title">{focusStatusLabel}</div>
                <div className="welcome-spotlight__meta">
                  {showDepartmentSummary
                    ? "Personal and department timelines are visible and ready for review."
                    : "Your personal task board is ready for a smooth start."}
                </div>
              </div>
            </div>

            <div className="welcome-spotlight__grid">
              <div className="welcome-spotlight__item">
                <span className="welcome-spotlight__item-label">Checklist</span>
                <strong>{checklistPendingCount}</strong>
              </div>
              <div className="welcome-spotlight__item">
                <span className="welcome-spotlight__item-label">Reminder</span>
                <strong>{reminderPendingCount}</strong>
              </div>
              <div className="welcome-spotlight__item">
                <span className="welcome-spotlight__item-label">Score Focus</span>
                <strong>{personalPendingCount > 0 ? "On Time" : "Stable"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="welcome-stats">
          <div className="welcome-stat">
            <div className="welcome-stat__label">Pending Tasks</div>
            <div className="welcome-stat__value">
              <CountUpNumber
                key={`pending-stat-${personalPendingCount}`}
                value={personalPendingCount}
              />
            </div>
            <div className="welcome-stat__meta">Assigned to your account right now</div>
          </div>

          {showDepartmentSummary ? (
            <div className="welcome-stat welcome-stat--accent">
              <div className="welcome-stat__label">Department Pending</div>
              <div className="welcome-stat__value">
                <CountUpNumber
                  key={`department-stat-${departmentPendingCount}`}
                  value={departmentPendingCount}
                />
              </div>
              <div className="welcome-stat__meta">
                Your Department Overall Task Pending: {departmentPendingCount}
              </div>
            </div>
          ) : null}
        </div>

        <div className="welcome-chip-row">
          <span className="welcome-chip">
            Checklist Tasks <strong>{checklistPendingCount}</strong>
          </span>
          <span className="welcome-chip welcome-chip--soft">
            Personal Reminders <strong>{reminderPendingCount}</strong>
          </span>
          {loading ? <span className="welcome-chip welcome-chip--loading">Refreshing counts</span> : null}
        </div>

        <div className="welcome-message-list">
          {motivationalMessages.map((message) => (
            <div className="welcome-message" key={message}>
              <span className="welcome-message__dot" aria-hidden="true" />
              <span>{message}</span>
            </div>
          ))}
        </div>

        {loadError ? (
          <div className="alert alert-warning py-2 px-3 mt-3 mb-0" role="alert">
            {loadError}
          </div>
        ) : null}

        <div className="welcome-card__actions">
          <button type="button" className="btn btn-primary welcome-action-btn" onClick={handleContinue}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
