const TASK_OPEN_BASIS_LABELS = {
  system: "System Base Time",
};

const TASK_OPEN_UNIT_LABELS = {
  minutes: { singular: "minute", plural: "minutes" },
  hours: { singular: "hour", plural: "hours" },
  days: { singular: "day", plural: "days" },
};

const resolveTaskOpenBasis = (source = {}) =>
  String(source.taskOpenBasis || "system")
    .trim()
    .toLowerCase();

const resolveTaskOpenBeforeValue = (source = {}) => {
  const value = Number(source.taskOpenBeforeValue ?? 0);
  if (Number.isNaN(value) || value < 0) return 0;
  return value;
};

const resolveTaskOpenBeforeUnit = (source = {}) => {
  const normalized = String(source.taskOpenBeforeUnit || "minutes")
    .trim()
    .toLowerCase();
  return TASK_OPEN_UNIT_LABELS[normalized] ? normalized : "minutes";
};

const hasTaskOpenRule = (source = {}) =>
  source.taskOpenSummary !== undefined ||
  source.taskOpenBasis !== undefined ||
  source.taskOpenBeforeValue !== undefined ||
  source.taskOpenBeforeUnit !== undefined;

export const getChecklistTaskOpenBasisLabel = (source = {}) => {
  if (!hasTaskOpenRule(source)) {
    return "Legacy Time Rule";
  }

  const basis = resolveTaskOpenBasis(source);
  return TASK_OPEN_BASIS_LABELS[basis] || basis || "N/A";
};

export const getChecklistTaskOpenBeforeDisplay = (source = {}) => {
  if (!hasTaskOpenRule(source)) {
    return "N/A";
  }

  const value = resolveTaskOpenBeforeValue(source);
  const unit = resolveTaskOpenBeforeUnit(source);
  const labels = TASK_OPEN_UNIT_LABELS[unit];

  return `${value} ${value === 1 ? labels.singular : labels.plural}`;
};

export const getChecklistTaskOpenSummary = (source = {}) => {
  const savedSummary = String(source.taskOpenSummary || "").trim();
  if (savedSummary) {
    return savedSummary;
  }

  if (!hasTaskOpenRule(source)) {
    const legacyCreationTime = String(source.taskCreationTime || "").trim();
    return legacyCreationTime ? `Opens at ${legacyCreationTime}` : "N/A";
  }

  const basisLabel = getChecklistTaskOpenBasisLabel(source).toLowerCase();
  const value = resolveTaskOpenBeforeValue(source);
  const unit = resolveTaskOpenBeforeUnit(source);
  const labels = TASK_OPEN_UNIT_LABELS[unit];

  if (value <= 0) {
    return `Opens on ${basisLabel}`;
  }

  return `Opens ${value} ${
    value === 1 ? labels.singular : labels.plural
  } before ${basisLabel}`;
};
