const normalizeText = (value) => String(value || "").trim();

const formatVoteCountLabel = (count) => {
  const safeCount = Math.max(0, Number(count || 0));
  return `${safeCount} vote${safeCount === 1 ? "" : "s"}`;
};

const formatPercentageLabel = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "0";

  const rounded = Math.round(numericValue * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const getQuestionOptionMetrics = (question = {}) => {
  const totalResponses = Math.max(0, Number(question?.totalResponses || 0));
  const optionCounts = Array.isArray(question?.optionCounts) ? question.optionCounts : [];
  const hasResponses = totalResponses > 0;

  return optionCounts.map((option) => {
    const count = Math.max(0, Number(option?.count || 0));
    const percentageValue = hasResponses ? Math.min((count / totalResponses) * 100, 100) : 0;

    return {
      optionText: normalizeText(option?.optionText) || "Untitled option",
      count,
      percentageLabel: formatPercentageLabel(percentageValue),
    };
  });
};

export const buildPollShareSummary = (reportData) => {
  const pollTitle = normalizeText(reportData?.poll?.title) || "Poll Results";
  const questionResults = Array.isArray(reportData?.questionResults) ? reportData.questionResults : [];
  const totalResponses = Math.max(0, Number(reportData?.summary?.totalResponses || 0));
  const lines = [`Poll Title: ${pollTitle}`, ""];

  if (!questionResults.length) {
    lines.push("No aggregated poll result data is available for the selected report.");
    lines.push("");
    lines.push(`Total Responses: ${totalResponses}`);
    return lines.join("\n").trim();
  }

  questionResults.forEach((question, index) => {
    const questionText = normalizeText(question?.questionText) || `Question ${index + 1}`;
    const optionMetrics = getQuestionOptionMetrics(question);

    lines.push(`Question: ${questionText}`);

    if (!optionMetrics.length || Number(question?.totalResponses || 0) <= 0) {
      lines.push("- No responses yet");
    } else {
      optionMetrics.forEach((option) => {
        lines.push(
          `- ${option.optionText}: ${option.percentageLabel}% (${formatVoteCountLabel(option.count)})`
        );
      });
    }

    lines.push("");
  });

  lines.push(`Total Responses: ${totalResponses}`);

  return lines.join("\n").trim();
};

export const buildWhatsAppShareUrl = (summaryText) =>
  `https://wa.me/?text=${encodeURIComponent(summaryText)}`;

export const buildTelegramShareUrl = (summaryText) =>
  `https://t.me/share/url?text=${encodeURIComponent(summaryText)}`;
