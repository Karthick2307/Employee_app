import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import {
  formatPollAssignmentStatusLabel,
  formatPollDateTime,
  formatPollWindowStateLabel,
  getPollAssignmentBadgeClass,
  getPollWindowBadgeClass,
} from "../../utils/pollDisplay";
import {
  buildPollShareSummary,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
} from "../../utils/pollReportShare";

const buildUploadBaseUrl = () =>
  (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, "");

const formatVoteCountLabel = (count) => `${count} vote${count === 1 ? "" : "s"}`;

const formatPercentageLabel = (value) => {
  if (!Number.isFinite(value) || value <= 0) return "0";

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const getQuestionOptionMetrics = (question = {}) => {
  const totalResponses = Math.max(0, Number(question?.totalResponses || 0));
  const optionCounts = Array.isArray(question?.optionCounts) ? question.optionCounts : [];
  const highestCount = optionCounts.reduce(
    (maxCount, option) => Math.max(maxCount, Number(option?.count || 0)),
    0
  );
  const hasResponses = totalResponses > 0;

  const options = optionCounts.map((option) => {
    const count = Math.max(0, Number(option?.count || 0));
    const percentageValue = hasResponses ? Math.min((count / totalResponses) * 100, 100) : 0;

    return {
      optionId: option?.optionId,
      optionText: option?.optionText,
      count,
      percentageValue,
      percentageLabel: formatPercentageLabel(percentageValue),
      isTop: hasResponses && highestCount > 0 && count === highestCount,
    };
  });

  return {
    hasResponses,
    options,
    topOptionCount: options.filter((option) => option.isTop).length,
  };
};

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.04 2C6.57 2 2.13 6.39 2.13 11.81c0 1.74.46 3.44 1.33 4.93L2 22l5.43-1.42a10 10 0 0 0 4.61 1.11h.01c5.47 0 9.91-4.39 9.91-9.81C21.96 6.39 17.51 2 12.04 2Zm5.77 13.87c-.24.67-1.42 1.28-1.96 1.33-.5.04-1.14.06-1.84-.16-.43-.14-.98-.32-1.69-.63-2.98-1.29-4.92-4.31-5.07-4.51-.14-.19-1.21-1.58-1.21-3.01s.76-2.12 1.03-2.41c.27-.29.59-.36.79-.36.2 0 .4 0 .58.01.19.01.44-.07.69.52.24.57.82 1.96.89 2.1.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.39-.43.52-.14.14-.28.3-.12.58.17.29.73 1.19 1.56 1.93 1.08.95 1.99 1.25 2.28 1.39.29.14.46.12.64-.07.17-.19.73-.85.93-1.14.19-.29.39-.24.66-.14.27.1 1.69.79 1.98.93.29.14.48.21.55.33.07.12.07.69-.17 1.36Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.78 18.65c-.37 0-.31-.14-.44-.5l-1.12-3.7 8.64-5.47" />
      <path d="M9.78 18.65c.29 0 .42-.13.58-.29l1.57-1.52-1.96-1.18" />
      <path d="M9.97 14.66 14.7 18.1c.54.3.92.14 1.06-.5l1.9-8.96c.2-.79-.3-1.15-.82-.92L5.66 11.98c-.77.3-.76.73-.14.92l2.88.9 6.67-4.2c.31-.19.59-.09.36.12" />
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function PollReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pollOptions, setPollOptions] = useState([]);
  const [loadingPolls, setLoadingPolls] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const uploadBaseUrl = useMemo(buildUploadBaseUrl, []);

  const [filters, setFilters] = useState({
    pollId: searchParams.get("pollId") || "",
    companyId: "",
    siteId: "",
    departmentId: "",
    employeeId: "",
    questionId: "",
    status: "",
    search: "",
  });
  const shareSummaryText = useMemo(() => buildPollShareSummary(reportData), [reportData]);
  const canUseNativeShare = Boolean(
    typeof navigator !== "undefined" && typeof navigator.share === "function"
  );
  const hasShareableReport = Boolean(filters.pollId && reportData && shareSummaryText);

  useEffect(() => {
    const loadPollOptions = async () => {
      setLoadingPolls(true);

      try {
        const response = await api.get("/polls");
        setPollOptions(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Poll option load failed:", err);
        setPollOptions([]);
      } finally {
        setLoadingPolls(false);
      }
    };

    void loadPollOptions();
  }, []);

  useEffect(() => {
    if (!filters.pollId) {
      setReportData(null);
      return;
    }

    const loadReport = async () => {
      setLoadingReport(true);

      try {
        const response = await api.get(`/polls/reports/${filters.pollId}`, {
          params: {
            companyId: filters.companyId || undefined,
            siteId: filters.siteId || undefined,
            departmentId: filters.departmentId || undefined,
            employeeId: filters.employeeId || undefined,
            questionId: filters.questionId || undefined,
            status: filters.status || undefined,
            search: filters.search || undefined,
          },
        });

        setReportData(response.data || null);
      } catch (err) {
        console.error("Poll report load failed:", err);
        setReportData(null);
      } finally {
        setLoadingReport(false);
      }
    };

    void loadReport();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((currentFilters) => {
      const nextFilters = {
        ...currentFilters,
        [key]: value,
      };

      if (key === "pollId") {
        nextFilters.companyId = "";
        nextFilters.siteId = "";
        nextFilters.departmentId = "";
        nextFilters.employeeId = "";
        nextFilters.questionId = "";
        nextFilters.status = "";
        nextFilters.search = "";
        setSearchParams(value ? { pollId: value } : {});
      }

      return nextFilters;
    });
  };

  const openShareTarget = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setShareModalOpen(false);
  };

  const handleNativeShare = async () => {
    if (!canUseNativeShare || !hasShareableReport) return;

    try {
      await navigator.share({
        title: reportData?.poll?.title || "Poll Results",
        text: shareSummaryText,
      });
      setShareModalOpen(false);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Native poll result share failed:", err);
      }
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Polling</div>
            <h3 className="mb-1">Poll Results</h3>
            <p className="page-subtitle mb-0">
              Review response counts, pending participants, remarks, and attachments by scope or user.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-primary d-inline-flex align-items-center gap-2"
              onClick={() => setShareModalOpen(true)}
              disabled={!hasShareableReport}
            >
              <ShareIcon />
              <span>Share</span>
            </button>

            <Link className="btn btn-outline-secondary" to="/polls">
              Back to Polls
            </Link>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label fw-semibold">Poll</label>
            <select
              className="form-select"
              value={filters.pollId}
              onChange={(event) => handleFilterChange("pollId", event.target.value)}
              disabled={loadingPolls}
            >
              <option value="">Select poll</option>
              {pollOptions.map((poll) => (
                <option key={poll._id} value={poll._id}>
                  {poll.title}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-2">
            <label className="form-label fw-semibold">Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All</option>
              <option value="submitted">Submitted</option>
              <option value="not_answered">Not Answered</option>
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Company</label>
            <select
              className="form-select"
              value={filters.companyId}
              onChange={(event) => handleFilterChange("companyId", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All Companies</option>
              {(reportData?.filterOptions?.companies || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Site</label>
            <select
              className="form-select"
              value={filters.siteId}
              onChange={(event) => handleFilterChange("siteId", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All Sites</option>
              {(reportData?.filterOptions?.sites || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Department</label>
            <select
              className="form-select"
              value={filters.departmentId}
              onChange={(event) => handleFilterChange("departmentId", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All Departments</option>
              {(reportData?.filterOptions?.departments || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Employee</label>
            <select
              className="form-select"
              value={filters.employeeId}
              onChange={(event) => handleFilterChange("employeeId", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All Employees</option>
              {(reportData?.filterOptions?.employees || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Question</label>
            <select
              className="form-select"
              value={filters.questionId}
              onChange={(event) => handleFilterChange("questionId", event.target.value)}
              disabled={!filters.pollId}
            >
              <option value="">All Questions</option>
              {(reportData?.filterOptions?.questions || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              placeholder="Search employee or remarks"
              disabled={!filters.pollId}
            />
          </div>
        </div>
      </div>

      {!filters.pollId ? (
        <div className="soft-card text-center py-5 text-muted">
          Select a poll to review the results.
        </div>
      ) : loadingReport ? (
        <div className="soft-card text-center py-5 text-muted">Loading report...</div>
      ) : !reportData ? (
        <div className="soft-card text-center py-5 text-muted">No report data found.</div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-lg-3">
              <div className="soft-card h-100">
                <div className="small text-muted">Poll Window</div>
                <div className="fw-semibold">
                  {formatPollDateTime(reportData.poll?.startDateTime || reportData.poll?.startDate)} to{" "}
                  {formatPollDateTime(reportData.poll?.endDateTime || reportData.poll?.endDate)}
                </div>
              </div>
            </div>
            <div className="col-lg-3">
              <div className="soft-card h-100">
                <div className="small text-muted">Poll Status</div>
                <div className="mt-2">
                  <span className={`badge ${getPollWindowBadgeClass(reportData.poll?.windowState || reportData.poll?.status)}`}>
                    {formatPollWindowStateLabel(reportData.poll?.windowState || reportData.poll?.status)}
                  </span>
                </div>
              </div>
            </div>
            <div className="col-lg-3">
              <div className="soft-card h-100">
                <div className="small text-muted">Total Responses</div>
                <div className="display-6 fw-semibold">{reportData.summary?.totalResponses || 0}</div>
              </div>
            </div>
            <div className="col-lg-3">
              <div className="soft-card h-100">
                <div className="small text-muted">Pending Responses</div>
                <div className="display-6 fw-semibold">{reportData.summary?.pendingResponses || 0}</div>
              </div>
            </div>
          </div>

          <div className="d-flex flex-column gap-3 mb-4">
            {(reportData.questionResults || []).map((question) => {
              const { hasResponses, options, topOptionCount } = getQuestionOptionMetrics(question);
              const showAllTied = hasResponses && options.length > 1 && topOptionCount === options.length;
              const showTopTie = hasResponses && topOptionCount > 1 && !showAllTied;

              return (
                <div className="soft-card" key={question.questionId}>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                    <div>
                      <div className="fw-semibold">{question.questionText}</div>
                      <div className="small text-muted">
                        {question.totalResponses || 0} response{question.totalResponses === 1 ? "" : "s"}
                      </div>
                    </div>

                    {!hasResponses ? (
                      <span className="badge poll-report-question__badge">No data</span>
                    ) : showAllTied ? (
                      <span className="badge poll-report-question__badge poll-report-question__badge--top">
                        All options tied
                      </span>
                    ) : showTopTie ? (
                      <span className="badge poll-report-question__badge poll-report-question__badge--top">
                        Tie for top
                      </span>
                    ) : (
                      <span className="badge poll-report-question__badge poll-report-question__badge--top">
                        Most selected
                      </span>
                    )}
                  </div>

                  {!hasResponses ? (
                    <div className="poll-report-question__empty">
                      No data yet for this question. Percentages and highlights will appear after responses are
                      submitted.
                    </div>
                  ) : null}

                  <div className="poll-report-options">
                    {options.map((option) => {
                      const optionText = option.optionText || "Untitled option";

                      return (
                        <div
                          className={`poll-report-option ${option.isTop ? "poll-report-option--top" : ""} ${
                            !hasResponses ? "poll-report-option--empty" : ""
                          }`}
                          key={option.optionId || optionText}
                          title={`${optionText}: ${option.percentageLabel}% (${formatVoteCountLabel(option.count)})`}
                        >
                          <div className="poll-report-option__header">
                            <div className="poll-report-option__copy">
                              <div className="poll-report-option__label-row">
                                <span className="poll-report-option__label">{optionText}</span>
                                {option.isTop ? (
                                  <span className="poll-report-option__accent">Top choice</span>
                                ) : null}
                              </div>
                              <div className="poll-report-option__meta">
                                {option.percentageLabel}% ({formatVoteCountLabel(option.count)})
                              </div>
                            </div>

                            <div className="poll-report-option__summary" aria-hidden="true">
                              <span className="poll-report-option__percentage">{option.percentageLabel}%</span>
                              <span className="poll-report-option__votes">{formatVoteCountLabel(option.count)}</span>
                            </div>
                          </div>

                          <div
                            className="poll-report-option__progress"
                            role="progressbar"
                            aria-label={`${optionText}: ${option.percentageLabel}% selected`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(option.percentageValue)}
                          >
                            <div
                              className={`poll-report-option__progress-fill ${
                                option.isTop ? "poll-report-option__progress-fill--top" : ""
                              }`}
                              style={{ width: `${option.percentageValue}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="table-shell">
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Answers</th>
                    <th>Remarks</th>
                    <th>Attachments</th>
                    <th>Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData.responseRows || []).length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4">
                        No responses found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    reportData.responseRows.map((row, index) => (
                      <tr key={row.assignmentId}>
                        <td>{index + 1}</td>
                        <td>
                          <div className="fw-semibold">{row.employeeLabel}</div>
                          <div className="small text-muted">
                            {(row.companyLabels || []).join(", ") || "-"}
                          </div>
                          <div className="small text-muted">
                            {(row.siteLabels || []).join(", ") || "-"}
                          </div>
                          <div className="small text-muted">
                            {(row.departmentLabels || []).join(", ") || "-"}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${getPollAssignmentBadgeClass(row.status)}`}>
                            {formatPollAssignmentStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          {(row.answers || []).length ? (
                            <div className="d-flex flex-column gap-2">
                              {row.answers.map((answer) => (
                                <div key={answer.questionId}>
                                  <div className="fw-semibold small">{answer.questionText}</div>
                                  <div className="small text-muted">
                                    {(answer.selectedOptionTexts || []).join(", ") || "-"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>{row.remarks || "-"}</td>
                        <td>
                          {(row.attachments || []).length ? (
                            <div className="d-flex flex-column gap-2">
                              {row.attachments.map((file, fileIndex) => (
                                <a
                                  key={`${file.fileName}-${fileIndex}`}
                                  href={`${uploadBaseUrl}/uploads/${file.fileName}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {file.originalName || file.fileName}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>{formatPollDateTime(row.submittedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {shareModalOpen ? (
        <div
          className="modal fade show d-block app-modal-overlay"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          onClick={() => setShareModalOpen(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered poll-report-share-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-content poll-report-share-modal__content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-1">Share Poll Results</h5>
                  <div className="small text-muted">
                    Share the aggregated poll summary only. Individual responses, remarks, and attachments are not included.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setShareModalOpen(false)}
                />
              </div>

              <div className="modal-body d-flex flex-column gap-3">
                <div className="poll-report-share-modal__summary">
                  <div className="small text-muted fw-semibold mb-2">Preview</div>
                  <pre className="poll-report-share-modal__preview mb-0">{shareSummaryText}</pre>
                </div>

                <div className="poll-report-share-modal__actions">
                  {canUseNativeShare ? (
                    <button
                      type="button"
                      className="poll-report-share-option poll-report-share-option--native"
                      onClick={handleNativeShare}
                    >
                      <span className="poll-report-share-option__icon">
                        <ShareIcon />
                      </span>
                      <span className="poll-report-share-option__copy">
                        <span className="poll-report-share-option__title">Share via Device</span>
                        <span className="poll-report-share-option__meta">
                          Use native share in supported mobile browsers
                        </span>
                      </span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="poll-report-share-option poll-report-share-option--whatsapp"
                    onClick={() => openShareTarget(buildWhatsAppShareUrl(shareSummaryText))}
                  >
                    <span className="poll-report-share-option__icon">
                      <WhatsAppIcon />
                    </span>
                    <span className="poll-report-share-option__copy">
                      <span className="poll-report-share-option__title">WhatsApp</span>
                      <span className="poll-report-share-option__meta">
                        Share summary text in WhatsApp
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="poll-report-share-option poll-report-share-option--telegram"
                    onClick={() => openShareTarget(buildTelegramShareUrl(shareSummaryText))}
                  >
                    <span className="poll-report-share-option__icon">
                      <TelegramIcon />
                    </span>
                    <span className="poll-report-share-option__copy">
                      <span className="poll-report-share-option__title">Telegram</span>
                      <span className="poll-report-share-option__meta">
                        Share summary text in Telegram
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
