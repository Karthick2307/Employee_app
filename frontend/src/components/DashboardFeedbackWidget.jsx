import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import api from "../api/axios";

const feedbackCategoryOptions = [
  "Bug Report",
  "Feature Request",
  "Improvement",
  "Other",
];

const satisfactionOptions = [
  { value: 1, emoji: "😔", label: "Very Dissatisfied" },
  { value: 2, emoji: "😐", label: "Dissatisfied" },
  { value: 3, emoji: "😊", label: "Satisfied" },
  { value: 4, emoji: "😀", label: "Very Satisfied" },
  { value: 5, emoji: "😍", label: "Excellent" },
];

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const buildInitialForm = (user) => ({
  name: String(user?.name || user?.employeeName || "").trim(),
  email: String(user?.email || "").trim(),
  category: "",
  satisfaction: 0,
  message: "",
});

export default function DashboardFeedbackWidget({ pageLabel = "Dashboard" }) {
  const location = useLocation();
  const user = useMemo(() => getUser(), []);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState(() => buildInitialForm(user));

  useEffect(() => {
    if (!successMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !sending) {
        setErrorMessage("");
        setIsOpen(false);
      }
    };

    document.body.classList.add("feedback-widget-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("feedback-widget-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, sending]);

  const openModal = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setIsOpen(true);
  };

  const closeModal = () => {
    if (sending) return;
    setErrorMessage("");
    setIsOpen(false);
  };

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((currentValue) => ({
      ...currentValue,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setErrorMessage("");

    try {
      await api.post("/feedback", {
        name: String(form.name || "").trim(),
        email: String(form.email || "").trim(),
        category: String(form.category || "").trim(),
        satisfaction: Number(form.satisfaction || 0),
        message: String(form.message || "").trim(),
        pagePath: location.pathname,
        pageTitle: pageLabel,
      });

      setForm(buildInitialForm(user));
      setIsOpen(false);
      setSuccessMessage("Feedback submitted successfully.");
    } catch (err) {
      console.error("Feedback submit failed:", err);
      setErrorMessage(err.response?.data?.message || "Failed to submit feedback");
    } finally {
      setSending(false);
    }
  };

  const successToast = successMessage ? (
    <div className="feedback-widget__toast" role="status">
      {successMessage}
    </div>
  ) : null;

  const feedbackButton = !isOpen ? (
    <button
      type="button"
      className="feedback-widget__button"
      onClick={openModal}
      aria-label="Open feedback form"
    >
      Feedback
    </button>
  ) : null;

  const feedbackModal = isOpen ? (
    <div
      className="modal fade show d-block app-modal-overlay feedback-widget__overlay"
      tabIndex="-1"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable feedback-widget__dialog">
        <div className="modal-content feedback-widget__modal">
          <div className="feedback-widget__header">
            <button
              type="button"
              className="btn-close feedback-widget__close"
              onClick={closeModal}
              disabled={sending}
              aria-label="Close feedback form"
            />
            <h3 className="mb-2">Share Your Feedback</h3>
            <p className="page-subtitle mb-0">Help us improve our service</p>
          </div>

          <div className="modal-body feedback-widget__body">
            {errorMessage ? (
              <div className="alert alert-danger py-2" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <form className="feedback-widget__form" onSubmit={handleSubmit}>
              <div>
                <label className="form-label fw-semibold">Name</label>
                <input
                  className="form-control"
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  placeholder="Enter your name"
                  required
                />
              </div>

              <div>
                <label className="form-label fw-semibold">Email</label>
                <input
                  className="form-control"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={updateField}
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label className="form-label fw-semibold">Feedback Category</label>
                <select
                  className="form-select"
                  name="category"
                  value={form.category}
                  onChange={updateField}
                  required
                >
                  <option value="">Select a category</option>
                  {feedbackCategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label fw-semibold">How satisfied are you?</label>
                <div
                  className="feedback-widget__rating-grid"
                  role="radiogroup"
                  aria-label="Satisfaction rating"
                >
                  {satisfactionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`feedback-widget__rating-btn${
                        Number(form.satisfaction) === option.value
                          ? " feedback-widget__rating-btn--active"
                          : ""
                      }`}
                      onClick={() =>
                        setForm((currentValue) => ({
                          ...currentValue,
                          satisfaction: option.value,
                        }))
                      }
                      aria-label={option.label}
                      aria-pressed={Number(form.satisfaction) === option.value}
                      title={option.label}
                    >
                      <span aria-hidden="true">{option.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label fw-semibold">Your Message</label>
                <textarea
                  className="form-control"
                  name="message"
                  rows="5"
                  value={form.message}
                  onChange={updateField}
                  placeholder="Tell us more about your experience..."
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary feedback-widget__submit"
                disabled={sending || !form.satisfaction}
              >
                {sending ? "Submitting..." : "Submit Feedback"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {portalTarget ? createPortal(successToast, portalTarget) : successToast}
      {portalTarget ? createPortal(feedbackButton, portalTarget) : feedbackButton}
      {portalTarget ? createPortal(feedbackModal, portalTarget) : feedbackModal}
    </>
  );
}
