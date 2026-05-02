import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  GENERAL_ATTACHMENT_ACCEPT,
  GENERAL_ATTACHMENT_OPTIONS,
  validateFiles,
} from "../../utils/fileValidation";
import {
  formatPollAssignmentStatusLabel,
  formatPollDateTime,
  formatPollResponseTypeLabel,
  formatPollWindowStateLabel,
  getPollAssignmentBadgeClass,
  getPollWindowBadgeClass,
} from "../../utils/pollDisplay";

const toAnswerMap = (answers = []) =>
  (Array.isArray(answers) ? answers : []).reduce((result, answer) => {
    result[String(answer?.questionId || "")] = Array.isArray(answer?.selectedOptionIds)
      ? answer.selectedOptionIds.map((item) => String(item))
      : [];
    return result;
  }, {});

const buildUploadBaseUrl = () =>
  (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

export default function PollResponse() {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [task, setTask] = useState(null);
  const [answerMap, setAnswerMap] = useState({});
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState([]);
  const uploadBaseUrl = useMemo(buildUploadBaseUrl, []);

  useEffect(() => {
    const loadAssignment = async () => {
      setLoading(true);

      try {
        const response = await api.get(`/polls/my/${assignmentId}`);
        const payload = response.data || null;

        setTask(payload);
        setAnswerMap(toAnswerMap(payload?.response?.answers));
        setRemarks(payload?.response?.remarks || "");
        setAttachments([]);
      } catch (err) {
        alert(err.response?.data?.message || "Failed to load assigned poll");
        navigate("/polls");
      } finally {
        setLoading(false);
      }
    };

    void loadAssignment();
  }, [assignmentId, navigate]);

  const canSubmit = Boolean(task?.canSubmit);
  const poll = task?.poll || {};

  const handleSingleChoiceChange = (questionId, optionId) => {
    setAnswerMap((currentMap) => ({
      ...currentMap,
      [questionId]: [optionId],
    }));
  };

  const handleMultipleChoiceChange = (questionId, optionId) => {
    setAnswerMap((currentMap) => {
      const currentValues = Array.isArray(currentMap[questionId]) ? currentMap[questionId] : [];
      return {
        ...currentMap,
        [questionId]: currentValues.includes(optionId)
          ? currentValues.filter((currentOptionId) => currentOptionId !== optionId)
          : [...currentValues, optionId],
      };
    });
  };

  const handleAttachmentChange = (event) => {
    const files = event.target.files || [];
    const validationMessage = validateFiles(files, GENERAL_ATTACHMENT_OPTIONS);

    if (validationMessage) {
      alert(validationMessage);
      event.target.value = "";
      setAttachments([]);
      return;
    }

    setAttachments(files);
  };

  const submitResponse = async () => {
    const formData = new FormData();

    formData.append(
      "answers",
      JSON.stringify(
        (Array.isArray(poll.questions) ? poll.questions : []).map((question) => ({
          questionId: question._id,
          selectedOptionIds: answerMap[String(question._id)] || [],
        }))
      )
    );
    formData.append("remarks", remarks);

    Array.from(attachments || []).forEach((file) => {
      formData.append("attachments", file);
    });

    setSaving(true);
    try {
      await api.post(`/polls/my/${assignmentId}/submit`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const refreshed = await api.get(`/polls/my/${assignmentId}`);
      const payload = refreshed.data || null;
      setTask(payload);
      setAnswerMap(toAnswerMap(payload?.response?.answers));
      setRemarks(payload?.response?.remarks || "");
      setAttachments([]);
      alert("Poll response submitted successfully");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to submit poll response");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading poll...</div>;
  }

  if (!task) {
    return <div className="container mt-4">Assigned poll not found.</div>;
  }

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Polling</div>
            <h3 className="mb-1">{poll.title || "Assigned Poll"}</h3>
            <p className="page-subtitle mb-0">{poll.description || "Review the questions and submit your response."}</p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <span className={`badge ${getPollWindowBadgeClass(poll.windowState)}`}>
              {formatPollWindowStateLabel(poll.windowState)}
            </span>
            <span className={`badge ${getPollAssignmentBadgeClass(task.assignmentStatus)}`}>
              {formatPollAssignmentStatusLabel(task.assignmentStatus)}
            </span>
            <Link className="btn btn-outline-secondary" to="/polls">
              Back
            </Link>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <div className="row g-3">
          <div className="col-lg-3">
            <div className="small text-muted">Start Date Time</div>
            <div className="fw-semibold">{formatPollDateTime(poll.startDateTime || poll.startDate)}</div>
          </div>
          <div className="col-lg-3">
            <div className="small text-muted">End Date Time</div>
            <div className="fw-semibold">{formatPollDateTime(poll.endDateTime || poll.endDate)}</div>
          </div>
          <div className="col-lg-3">
            <div className="small text-muted">Questions</div>
            <div className="fw-semibold">
              {(Array.isArray(poll.questions) ? poll.questions.length : 0) || 0}
            </div>
          </div>
          <div className="col-lg-3">
            <div className="small text-muted">Last Submission</div>
            <div className="fw-semibold">{formatPollDateTime(task.response?.submittedAt)}</div>
          </div>
        </div>

        {!canSubmit ? (
          <div className="alert alert-light border mt-3 mb-0">
            {task.assignmentStatus === "submitted"
              ? "This poll has already been submitted. If resubmission is enabled, it will reopen automatically while the poll remains active."
              : poll.windowState === "upcoming"
              ? "This poll is upcoming. Submission will open at the scheduled start time."
              : poll.windowState === "expired"
              ? "This poll has expired. Submission is no longer available."
              : "This poll is not currently active for submission."}
          </div>
        ) : null}
      </div>

      <div className="d-flex flex-column gap-3">
        {(Array.isArray(poll.questions) ? poll.questions : []).map((question, questionIndex) => {
          const selectedOptionIds = answerMap[String(question._id)] || [];

          return (
            <div className="soft-card" key={question._id || questionIndex}>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <div className="fw-semibold">
                    Question {questionIndex + 1}
                  </div>
                  <div className="fs-5">{question.questionText}</div>
                </div>

                <span className="badge bg-light text-dark border">
                  {formatPollResponseTypeLabel(question.responseType)}
                </span>
              </div>

              <div className="d-flex flex-column gap-2">
                {(Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => {
                  const optionId = String(option._id || "");
                  const checked = selectedOptionIds.includes(optionId);

                  return (
                    <label
                      key={option._id || optionIndex}
                      className={`selection-option ${checked ? "selection-option--active" : ""}`}
                    >
                      <input
                        type={question.responseType === "multiple_choice" ? "checkbox" : "radio"}
                        className="form-check-input mt-1"
                        name={`question-${question._id}`}
                        checked={checked}
                        disabled={!canSubmit}
                        onChange={() =>
                          question.responseType === "multiple_choice"
                            ? handleMultipleChoiceChange(String(question._id), optionId)
                            : handleSingleChoiceChange(String(question._id), optionId)
                        }
                      />
                      <span className="selection-option__body">
                        <span className="selection-option__label">{option.text}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="soft-card mt-4">
        <div className="row g-4">
          <div className="col-lg-8">
            <label className="form-label fw-semibold">Remarks</label>
            <textarea
              className="form-control"
              rows="4"
              value={remarks}
              disabled={!canSubmit}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add any remarks or comments for this poll response"
            />
          </div>

          <div className="col-lg-4">
            <label className="form-label fw-semibold">Attachments</label>
            <input
              type="file"
              multiple
              className="form-control"
              disabled={!canSubmit}
              accept={GENERAL_ATTACHMENT_ACCEPT}
              onChange={handleAttachmentChange}
            />
            <div className="small text-muted mt-2">
              Upload supporting files together with your response if required.
            </div>
          </div>
        </div>

        {Array.isArray(task.response?.attachments) && task.response.attachments.length ? (
          <div className="mt-4">
            <div className="fw-semibold mb-2">Submitted Attachments</div>
            <div className="d-flex flex-column gap-2">
              {task.response.attachments.map((file, index) => (
                <a
                  key={`${file.fileName}-${index}`}
                  className="btn btn-outline-light text-start border"
                  href={`${uploadBaseUrl}/uploads/${file.fileName}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="fw-semibold text-dark">{file.originalName || file.fileName}</div>
                  <div className="small text-muted">
                    {file.size ? `${Math.round(Number(file.size || 0) / 1024)} KB` : "Attachment"}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <div className="d-flex justify-content-end gap-2 mt-4">
          <Link className="btn btn-outline-secondary" to="/polls">
            Close
          </Link>
          <button
            type="button"
            className="btn btn-success"
            onClick={submitResponse}
            disabled={!canSubmit || saving}
          >
            {saving
              ? "Submitting..."
              : task.assignmentStatus === "submitted" && canSubmit
              ? "Resubmit Response"
              : "Submit Response"}
          </button>
        </div>
      </div>
    </div>
  );
}
