import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import WelcomeCard from "../components/WelcomeCard";
import { usePermissions } from "../context/PermissionContext";
import welcomeBackground from "../images/welcome.jpg";
import "../styles/postLoginFlow.css";
import {
  dismissPostLoginWelcome,
  getPostLoginDestination,
  getStoredUser,
} from "../utils/postLoginWelcome";
import {
  formatAttendanceDuration,
  getAttendanceStatusBadgeClass,
} from "../utils/attendance";

function AttendanceHeroIcon() {
  return (
    <svg viewBox="0 0 84 84" aria-hidden="true">
      <defs>
        <linearGradient id="attendanceHeroGradient" x1="10%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#36d1dc" />
          <stop offset="100%" stopColor="#5b86e5" />
        </linearGradient>
      </defs>
      <rect x="10" y="14" width="64" height="56" rx="20" fill="url(#attendanceHeroGradient)" />
      <path
        d="M26 31h32M26 42h18M26 53h14"
        stroke="#f7ffff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="58" cy="53" r="12" fill="#fff4d6" />
      <path
        d="M58 47v8l5 3"
        stroke="#8d5f06"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const getReminderText = (todayRecord, settings, canViewSelfAttendance) => {
  if (!canViewSelfAttendance) {
    return "Review your attendance module from the dashboard whenever you need a detailed update.";
  }

  if (!todayRecord) {
    return "Your attendance snapshot is on the way.";
  }

  if (Number(todayRecord.lateMinutes || 0) > 0 && settings?.lateAlertEnabled) {
    return `You are ${Number(todayRecord.lateMinutes || 0)} minute(s) late today. Keep the rest of the shift on track.`;
  }

  if (!todayRecord.checkInTime) {
    return "Don't forget to check-in before your shift starts.";
  }

  if (!todayRecord.checkOutTime) {
    return "Don't forget to check-out before you wrap up for the day.";
  }

  return "Your check-in and check-out look aligned for today.";
};

function AttendanceMetric({ label, value, meta, badgeClass = "" }) {
  return (
    <div className="attendance-welcome__metric">
      <div className="attendance-welcome__metric-label">{label}</div>
      {badgeClass ? (
        <span className={`badge attendance-welcome__metric-badge ${badgeClass}`}>{value}</span>
      ) : (
        <div className="attendance-welcome__metric-value">{value}</div>
      )}
      <div className="attendance-welcome__metric-meta">{meta}</div>
    </div>
  );
}

export default function AttendanceWelcomeScreen() {
  const navigate = useNavigate();
  const { user, can } = usePermissions();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const currentUser = user || storedUser;
  const displayName =
    currentUser?.name ||
    currentUser?.employeeName ||
    storedUser?.name ||
    storedUser?.employeeName ||
    "User";
  const canViewSelfAttendance =
    Boolean(currentUser?.principalType === "employee") && can("employee_attendance", "view");
  const [attendanceData, setAttendanceData] = useState({
    settings: null,
    employee: null,
    todayRecord: null,
  });
  const [loading, setLoading] = useState(canViewSelfAttendance);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    if (!canViewSelfAttendance) {
      setLoading(false);
      setLoadError("");
      return undefined;
    }

    const loadAttendanceSummary = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const response = await api.get("/attendance/self");

        if (!active) {
          return;
        }

        setAttendanceData({
          settings: response.data?.settings || null,
          employee: response.data?.employee || null,
          todayRecord: response.data?.todayRecord || null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setAttendanceData({
          settings: null,
          employee: null,
          todayRecord: null,
        });
        setLoadError(
          error.response?.data?.message ||
            "Attendance details could not be loaded right now, but you can still continue."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadAttendanceSummary();

    return () => {
      active = false;
    };
  }, [canViewSelfAttendance]);

  const todayRecord = attendanceData.todayRecord;
  const statusLabel = loading
    ? "Refreshing..."
    : canViewSelfAttendance
    ? todayRecord?.statusLabel || "Pending"
    : "Open from dashboard";
  const statusBadgeClass = canViewSelfAttendance
    ? getAttendanceStatusBadgeClass(todayRecord?.status, todayRecord?.isLate)
    : "bg-secondary";
  const reminderText = getReminderText(
    todayRecord,
    attendanceData.settings,
    canViewSelfAttendance
  );
  const workingHours =
    todayRecord?.totalWorkingHoursLabel ||
    formatAttendanceDuration(todayRecord?.totalWorkingMinutes);
  const focusLabel = loading
    ? "Preparing your attendance snapshot"
    : canViewSelfAttendance
    ? "Today's attendance status"
    : "Attendance guide";

  const handleContinue = () => {
    dismissPostLoginWelcome();
    navigate(getPostLoginDestination(currentUser), { replace: true });
  };

  return (
    <div className="post-login-flow post-login-flow--attendance">
      <div className="post-login-flow__bg" aria-hidden="true">
        <img className="attendance-welcome__bg-photo" src={welcomeBackground} alt="" />
        <span className="post-login-flow__orb post-login-flow__orb--one" />
        <span className="post-login-flow__orb post-login-flow__orb--two" />
        <span className="post-login-flow__orb post-login-flow__orb--three" />
      </div>

      <WelcomeCard
        className="post-login-flow__frame"
        contentClassName="post-login-flow__card attendance-welcome"
      >
        <div className="attendance-welcome__hero">
          <div className="attendance-welcome__copy">
            <h1 className="attendance-welcome__title">Hi, {displayName}</h1>
            <p className="attendance-welcome__lead">
              Check your attendance regularly. Don&apos;t forget to check-in and check-out so your
              day stays accurate from start to finish.
            </p>

            <div className="attendance-welcome__message-list">
              <div className="attendance-welcome__message">Check your attendance regularly</div>
              <div className="attendance-welcome__message">
                Don&apos;t forget to check-in and check-out
              </div>
              <div className="attendance-welcome__message">{reminderText}</div>
            </div>
          </div>

          <div className="attendance-welcome__visual">
            <div className="attendance-welcome__visual-card">
              <div className="attendance-welcome__visual-icon">
                <AttendanceHeroIcon />
              </div>
              <div className="attendance-welcome__visual-copy">
                <div className="attendance-welcome__visual-eyebrow">{focusLabel}</div>
                <div className="attendance-welcome__visual-title">
                  {attendanceData.employee?.displayName || displayName}
                </div>
                <div className="attendance-welcome__visual-meta">
                  {loading
                    ? "Loading your latest attendance view."
                    : canViewSelfAttendance
                    ? "Review today, recent punch timing, and late status at a glance."
                    : "You can continue now and use your dashboard modules for full attendance details."}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="attendance-welcome__metrics">
          <AttendanceMetric
            label="Today's Status"
            value={statusLabel}
            meta={loading ? "Please wait a moment" : "Live status for your current day"}
            badgeClass={statusBadgeClass}
          />
          <AttendanceMetric
            label="Check In"
            value={loading ? "..." : todayRecord?.checkInLabel || "-"}
            meta="Use attendance punch timing to stay aligned"
          />
          <AttendanceMetric
            label="Check Out"
            value={loading ? "..." : todayRecord?.checkOutLabel || "-"}
            meta="Finish the day with a complete record"
          />
          <AttendanceMetric
            label="Working Hours"
            value={loading ? "..." : workingHours}
            meta={
              loading
                ? "Preparing today's summary"
                : canViewSelfAttendance
                ? "Based on today's attendance entry"
                : "Visible after you open Attendance from the dashboard"
            }
          />
        </div>

        {loadError ? (
          <div className="alert alert-warning py-2 px-3 mt-3 mb-0" role="alert">
            {loadError}
          </div>
        ) : null}

        <div className="attendance-welcome__actions">
          <button
            type="button"
            className="btn btn-primary attendance-welcome__action"
            onClick={handleContinue}
          >
            Continue
          </button>
        </div>
      </WelcomeCard>
    </div>
  );
}
