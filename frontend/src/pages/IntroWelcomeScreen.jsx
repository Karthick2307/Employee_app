import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import WelcomeCard from "../components/WelcomeCard";
import { usePermissions } from "../context/PermissionContext";
import { getStoredUser } from "../utils/postLoginWelcome";
import "../styles/postLoginFlow.css";

const AUTO_SLIDE_MS = 4000;

function AttendanceIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="attendanceIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26c6da" />
          <stop offset="100%" stopColor="#0d8fd8" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="44" height="40" rx="12" fill="url(#attendanceIconGradient)" />
      <path
        d="M20 26h24M20 34h14M20 42h11"
        stroke="#f5fffe"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="46" cy="42" r="8" fill="#fff4d1" />
      <path
        d="M46 38v5l3 2"
        stroke="#8f5b00"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="checklistIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f7f" />
          <stop offset="100%" stopColor="#ff5f6d" />
        </linearGradient>
      </defs>
      <rect x="12" y="10" width="40" height="44" rx="12" fill="url(#checklistIconGradient)" />
      <path
        d="M22 24l3 3 5-6M22 34l3 3 5-6M22 44l3 3 5-6"
        fill="none"
        stroke="#fff8ef"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M34 23h10M34 33h10M34 43h10"
        stroke="#fff8ef"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const SLIDES = [
  {
    key: "attendance",
    path: "/welcome/attendance",
    eyebrow: "Attendance Focus",
    title: "Attendance Management",
    subtitle: "Stay on top of daily attendance from the moment your shift begins.",
    points: [
      "Mark attendance regularly",
      "Check-in / Check-out on time",
      "Track attendance summary",
      "View late / leave / present status",
    ],
    accent: "#26c6da",
    accentSoft: "rgba(38, 198, 218, 0.22)",
    glow: "rgba(13, 143, 216, 0.28)",
    Icon: AttendanceIcon,
  },
  {
    key: "checklist",
    path: "/welcome/checklist",
    eyebrow: "Checklist Focus",
    title: "Checklist Tasks",
    subtitle: "Keep approvals, pending work, and task completion moving in one flow.",
    points: [
      "Complete checklist tasks on time",
      "Submit answers properly",
      "Track pending tasks",
      "Follow approval workflow",
    ],
    accent: "#ff7b72",
    accentSoft: "rgba(255, 123, 114, 0.22)",
    glow: "rgba(255, 95, 109, 0.28)",
    Icon: ChecklistIcon,
  },
];

export default function IntroWelcomeScreen() {
  const navigate = useNavigate();
  const { user } = usePermissions();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const displayName =
    user?.name || user?.employeeName || storedUser?.name || storedUser?.employeeName || "User";
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentValue) => (currentValue + 1) % SLIDES.length);
    }, AUTO_SLIDE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="post-login-flow post-login-flow--intro">
      <div className="post-login-flow__bg" aria-hidden="true">
        <span className="post-login-flow__orb post-login-flow__orb--one" />
        <span className="post-login-flow__orb post-login-flow__orb--two" />
        <span className="post-login-flow__orb post-login-flow__orb--three" />
        <span className="post-login-flow__grid" />
      </div>

      <WelcomeCard
        className="post-login-flow__frame"
        contentClassName="post-login-flow__card intro-slider"
      >
        <div className="intro-slider__topbar">
          <div>
            <h1 className="intro-slider__title">Hi, {displayName}</h1>
            <p className="intro-slider__lead">
              Review the quick module preview above, then choose where you want to continue using
              the buttons below.
            </p>
          </div>
        </div>

        <div className="intro-slider__slider-panel">
          <div className="intro-slider__viewport" aria-label="Post login preview slider">
            <div
              className="intro-slider__track"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {SLIDES.map((slide, index) => {
                const Icon = slide.Icon;
                const isActive = index === activeIndex;

                return (
                  <div className="intro-slider__slide" key={slide.key}>
                    <div
                      className={`intro-slider__display-card${isActive ? " is-active" : ""}`}
                      style={{
                        "--intro-card-accent": slide.accent,
                        "--intro-card-accent-soft": slide.accentSoft,
                        "--intro-card-glow": slide.glow,
                      }}
                    >
                      <div className="intro-slider__icon-wrap">
                        <Icon />
                      </div>

                      <div className="intro-slider__copy">
                        <div className="intro-slider__card-eyebrow">{slide.eyebrow}</div>
                        <div className="intro-slider__card-title">{slide.title}</div>
                        <p className="intro-slider__card-subtitle">{slide.subtitle}</p>

                        <div className="intro-slider__point-list">
                          {slide.points.map((point) => (
                            <span className="intro-slider__point" key={point}>
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="intro-slider__dots" aria-label="Slider indicators">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className={`intro-slider__dot${index === activeIndex ? " is-active" : ""}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show ${slide.title}`}
              />
            ))}
          </div>
        </div>

        <div className="intro-slider__button-row">
          <button
            type="button"
            className="btn intro-slider__quick-btn intro-slider__quick-btn--attendance"
            onClick={() => navigate(SLIDES[0].path)}
          >
            <span className="intro-slider__quick-btn-icon">
              <AttendanceIcon />
            </span>
            <span>Attendance</span>
          </button>

          <button
            type="button"
            className="btn intro-slider__quick-btn intro-slider__quick-btn--checklist"
            onClick={() => navigate(SLIDES[1].path)}
          >
            <span className="intro-slider__quick-btn-icon">
              <ChecklistIcon />
            </span>
            <span>Checklist</span>
          </button>
        </div>
      </WelcomeCard>
    </div>
  );
}
