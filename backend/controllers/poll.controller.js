const { Types } = require("mongoose");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const PollAssignment = require("../models/PollAssignment");
const PollMaster = require("../models/PollMaster");
const PollNotification = require("../models/PollNotification");
const PollResponse = require("../models/PollResponse");
const Site = require("../models/Site");
const {
  buildCompanyScopeFilter,
  buildDepartmentScopeFilter,
  buildSiteScopeFilter,
  isAllScope,
  resolveAccessibleEmployeeIds,
} = require("../services/accessScope.service");

const POLL_SCOPE_TYPES = ["company", "site", "department"];
const POLL_RESPONSE_TYPES = ["single_choice", "multiple_choice"];
const POLL_STATUSES = ["active", "inactive"];
const POLL_ASSIGNMENT_STATUSES = ["not_answered", "submitted", "revoked"];
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeText = (value) => String(value || "").trim();
const normalizeId = (value) => String(value?._id || value || "").trim();
const uniqueIdList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (value) => Types.ObjectId.isValid(normalizeText(value));
const isEmployeeRequester = (user) =>
  normalizeText(user?.role).toLowerCase() === "employee";
const toObjectId = (value) => new Types.ObjectId(normalizeText(value));

const createHttpError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parseOptionalBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;

  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const parseDateValue = (value, fieldLabel) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw createHttpError(`${fieldLabel} is required`);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(`Select a valid ${fieldLabel.toLowerCase()}`);
  }

  return parsed;
};

const parseJsonArray = (value, fieldLabel) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      throw createHttpError(`${fieldLabel} must be valid JSON`);
    }
  }

  throw createHttpError(`${fieldLabel} must be an array`);
};

const formatEmployeeLabel = (employee) => {
  const employeeCode = normalizeText(employee?.employeeCode);
  const employeeName = normalizeText(employee?.employeeName);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName || "-";
};

const formatSiteLabel = (site) => {
  const companyName = normalizeText(site?.companyName);
  const siteName = normalizeText(site?.name);

  if (companyName && siteName) return `${companyName} - ${siteName}`;
  return siteName || companyName || "-";
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const formatDateOnly = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const getPollWindowState = (poll) => {
  if (normalizeText(poll?.status).toLowerCase() !== "active") return "inactive";

  const now = Date.now();
  const startAt = new Date(poll?.startDate || 0).getTime();
  const endAt = new Date(poll?.endDate || 0).getTime();

  if (Number.isFinite(startAt) && now < startAt) return "upcoming";
  if (Number.isFinite(endAt) && now > endAt) return "closed";
  return "active";
};

const canSubmitPoll = (poll, assignment) => {
  if (!poll || !assignment) return false;
  if (assignment.status === "revoked") return false;

  const windowState = getPollWindowState(poll);
  if (windowState !== "active") return false;

  if (assignment.status !== "submitted") return true;
  return Boolean(poll.allowResubmission);
};

const buildCreatorSnapshot = (user = {}) => ({
  createdById: user?.id,
  createdByPrincipalType: user?.principalType === "employee" ? "employee" : "user",
  createdByName: normalizeText(user?.name || user?.email || user?.employeeCode),
});

const buildUpdaterSnapshot = (user = {}) => ({
  updatedById: user?.id || null,
  updatedByPrincipalType: user?.principalType === "employee" ? "employee" : "user",
  updatedByName: normalizeText(user?.name || user?.email || user?.employeeCode),
});

const loadScopedMasterData = async (access = {}) => {
  const [companyFilter, siteFilter, departmentFilter] = await Promise.all([
    buildCompanyScopeFilter(access),
    buildSiteScopeFilter(access),
    buildDepartmentScopeFilter(access),
  ]);
  const [companies, sites, departments] = await Promise.all([
    Company.find({ ...companyFilter, isActive: { $ne: false } }).sort({ name: 1 }).lean(),
    Site.find({ ...siteFilter, isActive: { $ne: false } })
      .sort({ companyName: 1, name: 1 })
      .lean(),
    Department.find({ ...departmentFilter, isActive: { $ne: false } })
      .sort({ name: 1 })
      .lean(),
  ]);

  return { companies, sites, departments };
};

const mapScopedMasterOptions = (masterData = {}) => ({
  companies: (masterData.companies || []).map((company) => ({
    value: normalizeId(company),
    label: normalizeText(company?.name),
  })),
  sites: (masterData.sites || []).map((site) => ({
    value: normalizeId(site),
    label: formatSiteLabel(site),
  })),
  departments: (masterData.departments || []).map((department) => ({
    value: normalizeId(department),
    label: normalizeText(department?.name),
  })),
});

const resolveSelectedScopeDocs = ({
  scopeType,
  scopeIds,
  scopedMasterData,
}) => {
  const normalizedScopeType = normalizeText(scopeType).toLowerCase();
  const normalizedScopeIds = uniqueIdList(scopeIds);

  if (!POLL_SCOPE_TYPES.includes(normalizedScopeType)) {
    throw createHttpError("Select a valid scope type");
  }

  if (!normalizedScopeIds.length) {
    throw createHttpError("Select at least one scope item");
  }

  const rows =
    normalizedScopeType === "company"
      ? scopedMasterData.companies || []
      : normalizedScopeType === "site"
      ? scopedMasterData.sites || []
      : scopedMasterData.departments || [];

  const selectedRows = rows.filter((row) => normalizedScopeIds.includes(normalizeId(row)));

  if (selectedRows.length !== normalizedScopeIds.length) {
    throw createHttpError("One or more selected scope items are invalid or outside your access");
  }

  return {
    scopeType: normalizedScopeType,
    scopeIds: normalizedScopeIds.map((item) => toObjectId(item)),
    selectedRows,
  };
};

const parsePollQuestions = (questionsValue) => {
  const questionRows = parseJsonArray(questionsValue, "Questions");

  if (!questionRows.length) {
    throw createHttpError("Add at least one question");
  }

  return questionRows.map((row, questionIndex) => {
    const questionText = normalizeText(row?.questionText || row?.text || row?.question);
    if (!questionText) {
      throw createHttpError(`Question ${questionIndex + 1} text is required`);
    }

    const responseType = normalizeText(row?.responseType || "single_choice").toLowerCase();
    if (!POLL_RESPONSE_TYPES.includes(responseType)) {
      throw createHttpError(`Question ${questionIndex + 1} has an invalid response type`);
    }

    const optionRows = Array.isArray(row?.options) ? row.options : [];
    const seenOptions = new Set();
    const options = optionRows
      .map((optionRow, optionIndex) => {
        const text = normalizeText(optionRow?.text || optionRow?.label || optionRow);
        if (!text) {
          throw createHttpError(
            `Question ${questionIndex + 1} option ${optionIndex + 1} is required`
          );
        }

        const optionKey = text.toLowerCase();
        if (seenOptions.has(optionKey)) {
          return null;
        }
        seenOptions.add(optionKey);

        const nextOption = { text };
        if (isValidObjectId(optionRow?._id)) {
          nextOption._id = optionRow._id;
        }
        return nextOption;
      })
      .filter(Boolean);

    if (options.length < 2) {
      throw createHttpError(`Question ${questionIndex + 1} must include at least two options`);
    }

    const nextQuestion = {
      questionText,
      responseType,
      options,
    };

    if (isValidObjectId(row?._id)) {
      nextQuestion._id = row._id;
    }

    return nextQuestion;
  });
};

const serializeQuestionShape = (questions = []) =>
  (Array.isArray(questions) ? questions : []).map((question) => ({
    id: normalizeId(question?._id),
    questionText: normalizeText(question?.questionText),
    responseType: normalizeText(question?.responseType).toLowerCase(),
    options: (Array.isArray(question?.options) ? question.options : []).map((option) => ({
      id: normalizeId(option?._id),
      text: normalizeText(option?.text),
    })),
  }));

const buildPollPayload = ({ body = {}, scopedMasterData }) => {
  const title = normalizeText(body?.title);
  if (!title) {
    throw createHttpError("Poll title is required");
  }

  const description = normalizeText(body?.description || body?.purpose);
  const status = normalizeText(body?.status || "active").toLowerCase();
  if (!POLL_STATUSES.includes(status)) {
    throw createHttpError("Select a valid poll status");
  }

  const startDate = parseDateValue(body?.startDate, "Start date");
  const endDate = parseDateValue(body?.endDate, "End date");
  if (endDate.getTime() < startDate.getTime()) {
    throw createHttpError("End date cannot be earlier than start date");
  }

  const scopeSelection = resolveSelectedScopeDocs({
    scopeType: body?.scopeType,
    scopeIds: body?.scopeIds,
    scopedMasterData,
  });

  return {
    title,
    description,
    scopeType: scopeSelection.scopeType,
    scopeIds: scopeSelection.scopeIds,
    questions: parsePollQuestions(body?.questions),
    allowResubmission: parseOptionalBoolean(body?.allowResubmission, false),
    startDate,
    endDate,
    status,
  };
};

const loadScopedEmployees = async ({ scopeType, selectedRows, scopedMasterData }) => {
  let employeeFilter = { isActive: { $ne: false } };

  if (scopeType === "company") {
    const companyNames = selectedRows.map((row) => normalizeText(row?.name)).filter(Boolean);
    const matchedSites = (scopedMasterData.sites || []).filter((site) =>
      companyNames.includes(normalizeText(site?.companyName))
    );
    const siteIds = uniqueIdList(matchedSites.map((site) => site._id));
    if (!siteIds.length) return [];
    employeeFilter.sites = { $in: siteIds.map((siteId) => toObjectId(siteId)) };
  } else if (scopeType === "site") {
    const siteIds = uniqueIdList(selectedRows.map((row) => row._id));
    if (!siteIds.length) return [];
    employeeFilter.sites = { $in: siteIds.map((siteId) => toObjectId(siteId)) };
  } else {
    const departmentIds = uniqueIdList(selectedRows.map((row) => row._id));
    if (!departmentIds.length) return [];
    employeeFilter.department = { $in: departmentIds.map((departmentId) => toObjectId(departmentId)) };
  }

  const rows = await Employee.find(
    employeeFilter,
    "employeeCode employeeName email sites department"
  )
    .populate("sites", "name companyName")
    .populate("department", "name")
    .sort({ employeeName: 1, employeeCode: 1 })
    .lean();

  return rows;
};

const mapEmployeeScopeSummary = (employee = {}) => {
  const siteLabels = (Array.isArray(employee?.sites) ? employee.sites : [])
    .map((site) => formatSiteLabel(site))
    .filter(Boolean);
  const departmentLabels = (Array.isArray(employee?.department) ? employee.department : [])
    .map((department) => normalizeText(department?.name || department))
    .filter(Boolean);
  const companyLabels = [
    ...new Set(
      (Array.isArray(employee?.sites) ? employee.sites : [])
        .map((site) => normalizeText(site?.companyName))
        .filter(Boolean)
    ),
  ];

  return {
    companies: companyLabels,
    sites: siteLabels,
    departments: departmentLabels,
  };
};

const createAssignmentNotifications = async ({ poll, assignments = [] }) => {
  if (!assignments.length) return;

  await PollNotification.insertMany(
    assignments.map((assignment) => ({
      poll: poll._id,
      assignment: assignment._id,
      employee: assignment.employee,
      notificationType: "assigned",
      title: `New Poll: ${poll.title}`,
      message: `Your response is requested before ${formatDateOnly(poll.endDate)}.`,
      routePath: `/polls/my/${assignment._id}`,
    }))
  );
};

const syncPollAssignments = async ({ poll, employeeIds = [] }) => {
  const normalizedEmployeeIds = uniqueIdList(employeeIds);
  const targetSet = new Set(normalizedEmployeeIds);
  const existingAssignments = await PollAssignment.find({ poll: poll._id }).lean();
  const existingByEmployeeId = new Map(
    existingAssignments.map((assignment) => [normalizeId(assignment.employee), assignment])
  );
  const newAssignments = [];
  const updates = [];
  const now = new Date();

  normalizedEmployeeIds.forEach((employeeId) => {
    const existing = existingByEmployeeId.get(employeeId);

    if (!existing) {
      newAssignments.push({
        poll: poll._id,
        employee: toObjectId(employeeId),
        status: "not_answered",
        assignedAt: now,
      });
      return;
    }

    if (existing.status === "revoked") {
      updates.push(
        PollAssignment.updateOne(
          { _id: existing._id },
          {
            $set: {
              status: "not_answered",
              revokedAt: null,
              assignedAt: now,
            },
          }
        )
      );
    }
  });

  existingAssignments.forEach((assignment) => {
    const employeeId = normalizeId(assignment.employee);
    if (targetSet.has(employeeId)) return;
    if (assignment.status === "submitted") return;
    if (assignment.status === "revoked") return;

    updates.push(
      PollAssignment.updateOne(
        { _id: assignment._id },
        {
          $set: {
            status: "revoked",
            revokedAt: now,
          },
        }
      )
    );
  });

  let createdAssignments = [];
  if (newAssignments.length) {
    createdAssignments = await PollAssignment.insertMany(newAssignments);
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  const revivedAssignments = await PollAssignment.find({
    poll: poll._id,
    employee: { $in: normalizedEmployeeIds.map((employeeId) => toObjectId(employeeId)) },
    status: "not_answered",
    assignedAt: { $gte: new Date(now.getTime() - 1000) },
  }).lean();

  const notifyAssignments = [
    ...createdAssignments.map((assignment) => assignment.toObject()),
    ...revivedAssignments.filter(
      (assignment) =>
        !createdAssignments.some(
          (createdAssignment) =>
            normalizeId(createdAssignment._id) === normalizeId(assignment._id)
        )
    ),
  ];

  if (notifyAssignments.length) {
    await createAssignmentNotifications({ poll, assignments: notifyAssignments });
  }
};

const getSubmittedResponseCount = async (pollId) =>
  PollAssignment.countDocuments({
    poll: pollId,
    status: "submitted",
  });

const buildPollVisibilitySet = async (access = {}) => {
  if (isAllScope(access)) return null;

  const accessibleEmployeeIds = await resolveAccessibleEmployeeIds(access || {});
  if (!accessibleEmployeeIds.length) return new Set();

  const assignmentRows = await PollAssignment.find(
    {
      employee: { $in: accessibleEmployeeIds.map((employeeId) => toObjectId(employeeId)) },
    },
    "poll"
  ).lean();

  return new Set(assignmentRows.map((row) => normalizeId(row.poll)));
};

const filterVisiblePolls = async ({ polls = [], access = {}, user = {} }) => {
  const visibleSet = await buildPollVisibilitySet(access);
  if (visibleSet === null) return polls;

  return polls.filter(
    (poll) =>
      visibleSet.has(normalizeId(poll._id)) ||
      normalizeId(poll.createdById) === normalizeId(user?.id)
  );
};

const ensurePollAccess = async ({ pollId, access = {}, user = {} }) => {
  if (!isValidObjectId(pollId)) return null;

  const poll = await PollMaster.findById(pollId).lean();
  if (!poll) return null;

  if (isAllScope(access)) return poll;

  const visibleSet = await buildPollVisibilitySet(access);
  if (
    visibleSet.has(normalizeId(poll._id)) ||
    normalizeId(poll.createdById) === normalizeId(user?.id)
  ) {
    return poll;
  }

  return null;
};

const buildScopeLabelMap = async (polls = []) => {
  const companyIds = [];
  const siteIds = [];
  const departmentIds = [];

  polls.forEach((poll) => {
    const ids = uniqueIdList(poll?.scopeIds);
    if (poll?.scopeType === "company") companyIds.push(...ids);
    if (poll?.scopeType === "site") siteIds.push(...ids);
    if (poll?.scopeType === "department") departmentIds.push(...ids);
  });

  const [companies, sites, departments] = await Promise.all([
    companyIds.length
      ? Company.find({ _id: { $in: uniqueIdList(companyIds).map((id) => toObjectId(id)) } }).lean()
      : Promise.resolve([]),
    siteIds.length
      ? Site.find({ _id: { $in: uniqueIdList(siteIds).map((id) => toObjectId(id)) } }).lean()
      : Promise.resolve([]),
    departmentIds.length
      ? Department.find({
          _id: { $in: uniqueIdList(departmentIds).map((id) => toObjectId(id)) },
        }).lean()
      : Promise.resolve([]),
  ]);

  return {
    companyById: new Map(companies.map((company) => [normalizeId(company), company])),
    siteById: new Map(sites.map((site) => [normalizeId(site), site])),
    departmentById: new Map(
      departments.map((department) => [normalizeId(department), department])
    ),
  };
};

const formatPollScopeSummary = (poll, scopeLabelMap) => {
  const scopeIds = uniqueIdList(poll?.scopeIds);
  const labels =
    poll?.scopeType === "company"
      ? scopeIds
          .map((scopeId) => normalizeText(scopeLabelMap.companyById.get(scopeId)?.name))
          .filter(Boolean)
      : poll?.scopeType === "site"
      ? scopeIds
          .map((scopeId) => formatSiteLabel(scopeLabelMap.siteById.get(scopeId)))
          .filter((label) => label && label !== "-")
      : scopeIds
          .map((scopeId) => normalizeText(scopeLabelMap.departmentById.get(scopeId)?.name))
          .filter(Boolean);

  return {
    type: normalizeText(poll?.scopeType),
    labels,
    labelText: labels.join(", ") || "-",
  };
};

const loadPollAssignmentCounts = async (pollIds = []) => {
  const normalizedPollIds = uniqueIdList(pollIds);
  if (!normalizedPollIds.length) return new Map();

  const rows = await PollAssignment.aggregate([
    {
      $match: {
        poll: { $in: normalizedPollIds.map((pollId) => toObjectId(pollId)) },
      },
    },
    {
      $group: {
        _id: {
          poll: "$poll",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map();

  rows.forEach((row) => {
    const pollId = normalizeId(row?._id?.poll);
    if (!countMap.has(pollId)) {
      countMap.set(pollId, {
        total: 0,
        submitted: 0,
        pending: 0,
        revoked: 0,
      });
    }

    const currentValue = countMap.get(pollId);
    const status = normalizeText(row?._id?.status).toLowerCase();
    const count = Number(row?.count || 0);

    if (status === "revoked") {
      currentValue.revoked += count;
      return;
    }

    currentValue.total += count;
    if (status === "submitted") {
      currentValue.submitted += count;
    } else {
      currentValue.pending += count;
    }
  });

  return countMap;
};

const mapPollListRow = ({ poll, counts, scopeLabelMap }) => {
  const scopeSummary = formatPollScopeSummary(poll, scopeLabelMap);

  return {
    _id: poll._id,
    title: poll.title,
    description: poll.description || "",
    scopeType: poll.scopeType,
    scopeSummary,
    startDate: poll.startDate,
    endDate: poll.endDate,
    status: poll.status,
    allowResubmission: Boolean(poll.allowResubmission),
    questionCount: Array.isArray(poll.questions) ? poll.questions.length : 0,
    createdByName: poll.createdByName || "",
    createdAt: poll.createdAt || null,
    windowState: getPollWindowState(poll),
    counts: counts || {
      total: 0,
      submitted: 0,
      pending: 0,
      revoked: 0,
    },
  };
};

const mapPollDetailRow = ({ poll, scopeLabelMap }) => ({
  _id: poll._id,
  title: poll.title,
  description: poll.description || "",
  scopeType: poll.scopeType,
  scopeIds: uniqueIdList(poll.scopeIds),
  scopeSummary: formatPollScopeSummary(poll, scopeLabelMap),
  startDate: poll.startDate,
  endDate: poll.endDate,
  status: poll.status,
  allowResubmission: Boolean(poll.allowResubmission),
  questions: (Array.isArray(poll.questions) ? poll.questions : []).map((question) => ({
    _id: question._id,
    questionText: question.questionText,
    responseType: question.responseType,
    options: (Array.isArray(question.options) ? question.options : []).map((option) => ({
      _id: option._id,
      text: option.text,
    })),
  })),
  createdByName: poll.createdByName || "",
  createdAt: poll.createdAt || null,
  updatedAt: poll.updatedAt || null,
  windowState: getPollWindowState(poll),
});

const mapMyAssignmentRow = (assignment) => {
  const poll = assignment?.poll || {};
  return {
    _id: assignment?._id,
    pollId: poll?._id || null,
    title: normalizeText(poll?.title),
    description: normalizeText(poll?.description),
    startDate: poll?.startDate || null,
    endDate: poll?.endDate || null,
    pollStatus: normalizeText(poll?.status).toLowerCase() || "inactive",
    windowState: getPollWindowState(poll),
    assignmentStatus: normalizeText(assignment?.status).toLowerCase() || "not_answered",
    submittedAt: assignment?.submittedAt || null,
    allowResubmission: Boolean(poll?.allowResubmission),
    canSubmit: canSubmitPoll(poll, assignment),
    questionCount: Array.isArray(poll?.questions) ? poll.questions.length : 0,
  };
};

const mapMyAssignmentDetail = ({ assignment, response }) => {
  const poll = assignment?.poll || {};

  return {
    _id: assignment?._id,
    poll: {
      _id: poll?._id || null,
      title: normalizeText(poll?.title),
      description: normalizeText(poll?.description),
      startDate: poll?.startDate || null,
      endDate: poll?.endDate || null,
      status: normalizeText(poll?.status).toLowerCase() || "inactive",
      windowState: getPollWindowState(poll),
      allowResubmission: Boolean(poll?.allowResubmission),
      questions: (Array.isArray(poll?.questions) ? poll.questions : []).map((question) => ({
        _id: question?._id,
        questionText: normalizeText(question?.questionText),
        responseType: normalizeText(question?.responseType),
        options: (Array.isArray(question?.options) ? question.options : []).map((option) => ({
          _id: option?._id,
          text: normalizeText(option?.text),
        })),
      })),
    },
    assignmentStatus: normalizeText(assignment?.status).toLowerCase() || "not_answered",
    submittedAt: assignment?.submittedAt || null,
    canSubmit: canSubmitPoll(poll, assignment),
    response: response
      ? {
          _id: response._id,
          answers: (Array.isArray(response.answers) ? response.answers : []).map((answer) => ({
            questionId: normalizeId(answer?.questionId),
            selectedOptionIds: uniqueIdList(answer?.selectedOptionIds),
          })),
          remarks: normalizeText(response?.remarks),
          attachments: Array.isArray(response?.attachments) ? response.attachments : [],
          submittedAt: response?.submittedAt || null,
          updatedAt: response?.updatedAt || null,
        }
      : null,
  };
};

const parseResponseAnswers = (answersValue, poll) => {
  const answerRows = parseJsonArray(answersValue, "Answers");
  const answerMap = new Map(
    answerRows.map((row) => [normalizeId(row?.questionId), uniqueIdList(row?.selectedOptionIds)])
  );

  return (Array.isArray(poll?.questions) ? poll.questions : []).map((question, questionIndex) => {
    const questionId = normalizeId(question?._id);
    const selectedOptionIds = answerMap.get(questionId) || [];

    if (!selectedOptionIds.length) {
      throw createHttpError(`Select at least one option for question ${questionIndex + 1}`);
    }

    const validOptionIds = new Set(
      (Array.isArray(question?.options) ? question.options : []).map((option) => normalizeId(option?._id))
    );
    const filteredOptionIds = selectedOptionIds.filter((optionId) => validOptionIds.has(optionId));

    if (!filteredOptionIds.length || filteredOptionIds.length !== selectedOptionIds.length) {
      throw createHttpError(`Question ${questionIndex + 1} includes an invalid option`);
    }

    if (
      normalizeText(question?.responseType).toLowerCase() === "single_choice" &&
      filteredOptionIds.length !== 1
    ) {
      throw createHttpError(`Question ${questionIndex + 1} accepts only one answer`);
    }

    return {
      questionId: toObjectId(questionId),
      selectedOptionIds: filteredOptionIds.map((optionId) => toObjectId(optionId)),
    };
  });
};

const buildResponseAttachmentRows = (files = []) =>
  (Array.isArray(files) ? files : []).map((file) => ({
    fileName: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: Number(file.size || 0),
  }));

const buildReportEmployeeMeta = (employee = {}, companyByName = new Map()) => {
  const scopeSummary = mapEmployeeScopeSummary(employee);
  const companyIds = scopeSummary.companies
    .map((companyName) => normalizeId(companyByName.get(companyName)))
    .filter(Boolean);
  const siteIds = uniqueIdList((employee?.sites || []).map((site) => site?._id));
  const departmentIds = uniqueIdList((employee?.department || []).map((department) => department?._id));

  return {
    employeeId: normalizeId(employee),
    employeeLabel: formatEmployeeLabel(employee),
    companyIds,
    companyLabels: scopeSummary.companies,
    siteIds,
    siteLabels: scopeSummary.sites,
    departmentIds,
    departmentLabels: scopeSummary.departments,
  };
};

const mapReportAnswerRows = (poll, answers = []) => {
  const questionById = new Map(
    (Array.isArray(poll?.questions) ? poll.questions : []).map((question) => [
      normalizeId(question?._id),
      question,
    ])
  );

  return (Array.isArray(answers) ? answers : [])
    .map((answer) => {
      const question = questionById.get(normalizeId(answer?.questionId));
      if (!question) return null;

      const optionById = new Map(
        (Array.isArray(question?.options) ? question.options : []).map((option) => [
          normalizeId(option?._id),
          option,
        ])
      );

      return {
        questionId: normalizeId(question?._id),
        questionText: normalizeText(question?.questionText),
        selectedOptionIds: uniqueIdList(answer?.selectedOptionIds),
        selectedOptionTexts: uniqueIdList(answer?.selectedOptionIds)
          .map((optionId) => normalizeText(optionById.get(optionId)?.text))
          .filter(Boolean),
      };
    })
    .filter(Boolean);
};

exports.getPollSetupOptions = async (req, res) => {
  try {
    const scopedMasterData = await loadScopedMasterData(req.access || {});
    return res.json(mapScopedMasterOptions(scopedMasterData));
  } catch (err) {
    console.error("GET POLL SETUP OPTIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load poll setup options" });
  }
};

exports.previewPollAssignees = async (req, res) => {
  try {
    const scopedMasterData = await loadScopedMasterData(req.access || {});
    const scopeSelection = resolveSelectedScopeDocs({
      scopeType: req.body?.scopeType,
      scopeIds: req.body?.scopeIds,
      scopedMasterData,
    });
    const employees = await loadScopedEmployees({
      scopeType: scopeSelection.scopeType,
      selectedRows: scopeSelection.selectedRows,
      scopedMasterData,
    });

    return res.json({
      count: employees.length,
      employees: employees.slice(0, 50).map((employee) => ({
        _id: employee._id,
        employeeCode: employee.employeeCode || "",
        employeeName: employee.employeeName || "",
        label: formatEmployeeLabel(employee),
        ...mapEmployeeScopeSummary(employee),
      })),
    });
  } catch (err) {
    console.error("PREVIEW POLL ASSIGNEES ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to preview poll assignees",
    });
  }
};

exports.getPolls = async (req, res) => {
  try {
    const search = normalizeText(req.query?.search);
    const status = normalizeText(req.query?.status).toLowerCase();
    const scopeType = normalizeText(req.query?.scopeType).toLowerCase();
    let rows = await PollMaster.find({}).sort({ createdAt: -1 }).lean();
    rows = await filterVisiblePolls({ polls: rows, access: req.access || {}, user: req.user });

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      rows = rows.filter(
        (row) => searchRegex.test(row.title || "") || searchRegex.test(row.description || "")
      );
    }

    if (status && POLL_STATUSES.includes(status)) {
      rows = rows.filter((row) => normalizeText(row.status).toLowerCase() === status);
    }

    if (scopeType && POLL_SCOPE_TYPES.includes(scopeType)) {
      rows = rows.filter((row) => normalizeText(row.scopeType).toLowerCase() === scopeType);
    }

    const scopeLabelMap = await buildScopeLabelMap(rows);
    const countMap = await loadPollAssignmentCounts(rows.map((row) => row._id));

    return res.json(
      rows.map((poll) =>
        mapPollListRow({
          poll,
          counts: countMap.get(normalizeId(poll._id)),
          scopeLabelMap,
        })
      )
    );
  } catch (err) {
    console.error("GET POLLS ERROR:", err);
    return res.status(500).json({ message: "Failed to load polls" });
  }
};

exports.getPollById = async (req, res) => {
  try {
    const poll = await ensurePollAccess({
      pollId: req.params.id,
      access: req.access || {},
      user: req.user,
    });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const scopeLabelMap = await buildScopeLabelMap([poll]);
    return res.json(mapPollDetailRow({ poll, scopeLabelMap }));
  } catch (err) {
    console.error("GET POLL BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load poll" });
  }
};

exports.createPoll = async (req, res) => {
  try {
    const scopedMasterData = await loadScopedMasterData(req.access || {});
    const payload = buildPollPayload({ body: req.body, scopedMasterData });
    const scopeSelection = resolveSelectedScopeDocs({
      scopeType: payload.scopeType,
      scopeIds: payload.scopeIds,
      scopedMasterData,
    });
    const employeeRows = await loadScopedEmployees({
      scopeType: scopeSelection.scopeType,
      selectedRows: scopeSelection.selectedRows,
      scopedMasterData,
    });

    const poll = await PollMaster.create({
      ...payload,
      ...buildCreatorSnapshot(req.user),
      ...buildUpdaterSnapshot(req.user),
    });

    await syncPollAssignments({
      poll,
      employeeIds: employeeRows.map((employee) => employee._id),
    });

    return res.status(201).json({
      message: "Poll created successfully",
      pollId: poll._id,
    });
  } catch (err) {
    console.error("CREATE POLL ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to create poll",
    });
  }
};

exports.updatePoll = async (req, res) => {
  try {
    const poll = await ensurePollAccess({
      pollId: req.params.id,
      access: req.access || {},
      user: req.user,
    });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const scopedMasterData = await loadScopedMasterData(req.access || {});
    const payload = buildPollPayload({ body: req.body, scopedMasterData });
    const submittedCount = await getSubmittedResponseCount(poll._id);

    if (submittedCount > 0) {
      const currentScopeIds = uniqueIdList(poll.scopeIds);
      const nextScopeIds = uniqueIdList(payload.scopeIds);
      const scopeChanged =
        normalizeText(poll.scopeType).toLowerCase() !== payload.scopeType ||
        currentScopeIds.length !== nextScopeIds.length ||
        currentScopeIds.some((scopeId) => !nextScopeIds.includes(scopeId));
      const questionsChanged =
        JSON.stringify(serializeQuestionShape(poll.questions)) !==
        JSON.stringify(serializeQuestionShape(payload.questions));

      if (scopeChanged || questionsChanged) {
        return res.status(400).json({
          message:
            "Submitted polls can no longer change scope, questions, or answer options",
        });
      }
    }

    await PollMaster.updateOne(
      { _id: poll._id },
      {
        $set: {
          ...payload,
          ...buildUpdaterSnapshot(req.user),
        },
      }
    );

    const refreshedPoll = await PollMaster.findById(poll._id);
    const scopeSelection = resolveSelectedScopeDocs({
      scopeType: payload.scopeType,
      scopeIds: payload.scopeIds,
      scopedMasterData,
    });
    const employeeRows = await loadScopedEmployees({
      scopeType: scopeSelection.scopeType,
      selectedRows: scopeSelection.selectedRows,
      scopedMasterData,
    });

    await syncPollAssignments({
      poll: refreshedPoll,
      employeeIds: employeeRows.map((employee) => employee._id),
    });

    return res.json({ message: "Poll updated successfully" });
  } catch (err) {
    console.error("UPDATE POLL ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to update poll",
    });
  }
};

exports.deletePoll = async (req, res) => {
  try {
    const poll = await ensurePollAccess({
      pollId: req.params.id,
      access: req.access || {},
      user: req.user,
    });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const submittedCount = await getSubmittedResponseCount(poll._id);
    if (submittedCount > 0) {
      return res.status(400).json({
        message: "Polls with submitted responses cannot be deleted",
      });
    }

    await Promise.all([
      PollNotification.deleteMany({ poll: poll._id }),
      PollResponse.deleteMany({ poll: poll._id }),
      PollAssignment.deleteMany({ poll: poll._id }),
      PollMaster.deleteOne({ _id: poll._id }),
    ]);

    return res.json({ message: "Poll deleted successfully" });
  } catch (err) {
    console.error("DELETE POLL ERROR:", err);
    return res.status(500).json({ message: "Failed to delete poll" });
  }
};

exports.togglePollStatus = async (req, res) => {
  try {
    const poll = await ensurePollAccess({
      pollId: req.params.id,
      access: req.access || {},
      user: req.user,
    });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const nextStatus = normalizeText(poll.status).toLowerCase() === "active" ? "inactive" : "active";
    const updated = await PollMaster.findByIdAndUpdate(
      poll._id,
      {
        $set: {
          status: nextStatus,
          ...buildUpdaterSnapshot(req.user),
        },
      },
      { new: true }
    ).lean();

    return res.json({
      message: `Poll ${nextStatus === "active" ? "activated" : "deactivated"} successfully`,
      status: updated?.status || nextStatus,
    });
  } catch (err) {
    console.error("TOGGLE POLL STATUS ERROR:", err);
    return res.status(500).json({ message: "Failed to update poll status" });
  }
};

exports.getMyAssignedPolls = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view assigned polls" });
    }

    const search = normalizeText(req.query?.search);
    const status = normalizeText(req.query?.status).toLowerCase();
    let assignments = await PollAssignment.find({
      employee: req.user.id,
      status: { $ne: "revoked" },
    })
      .populate("poll")
      .sort({ assignedAt: -1 });

    assignments = assignments.filter((assignment) => assignment.poll);

    let rows = assignments.map((assignment) => mapMyAssignmentRow(assignment));

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      rows = rows.filter(
        (row) => searchRegex.test(row.title || "") || searchRegex.test(row.description || "")
      );
    }

    if (status && POLL_ASSIGNMENT_STATUSES.includes(status)) {
      rows = rows.filter((row) => normalizeText(row.assignmentStatus).toLowerCase() === status);
    }

    return res.json(rows);
  } catch (err) {
    console.error("GET MY ASSIGNED POLLS ERROR:", err);
    return res.status(500).json({ message: "Failed to load assigned polls" });
  }
};

exports.getMyPollByAssignment = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can open assigned polls" });
    }

    const assignment = await PollAssignment.findOne({
      _id: req.params.assignmentId,
      employee: req.user.id,
      status: { $ne: "revoked" },
    })
      .populate("poll")
      .lean();

    if (!assignment || !assignment.poll) {
      return res.status(404).json({ message: "Assigned poll not found" });
    }

    const response = assignment.response
      ? await PollResponse.findById(assignment.response).lean()
      : await PollResponse.findOne({ assignment: assignment._id }).lean();

    await Promise.all([
      PollAssignment.updateOne({ _id: assignment._id }, { $set: { lastViewedAt: new Date() } }),
      PollNotification.updateMany(
        {
          employee: req.user.id,
          assignment: assignment._id,
          readAt: null,
        },
        { $set: { readAt: new Date() } }
      ),
    ]);

    return res.json(
      mapMyAssignmentDetail({
        assignment,
        response,
      })
    );
  } catch (err) {
    console.error("GET MY POLL BY ASSIGNMENT ERROR:", err);
    return res.status(500).json({ message: "Failed to load assigned poll" });
  }
};

exports.submitPollResponse = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can submit poll responses" });
    }

    const assignment = await PollAssignment.findOne({
      _id: req.params.assignmentId,
      employee: req.user.id,
      status: { $ne: "revoked" },
    }).populate("poll");

    if (!assignment || !assignment.poll) {
      return res.status(404).json({ message: "Assigned poll not found" });
    }

    if (!canSubmitPoll(assignment.poll, assignment)) {
      return res.status(400).json({
        message: "This poll can no longer be submitted",
      });
    }

    if (assignment.status === "submitted" && !assignment.poll.allowResubmission) {
      return res.status(400).json({
        message: "This poll has already been submitted",
      });
    }

    const answers = parseResponseAnswers(req.body?.answers, assignment.poll);
    const remarks = normalizeText(req.body?.remarks);
    const attachmentRows = buildResponseAttachmentRows(req.files || []);
    const now = new Date();

    let response = assignment.response
      ? await PollResponse.findById(assignment.response)
      : await PollResponse.findOne({ assignment: assignment._id });

    if (!response) {
      response = await PollResponse.create({
        poll: assignment.poll._id,
        assignment: assignment._id,
        employee: req.user.id,
        answers,
        remarks,
        attachments: attachmentRows,
        submittedAt: now,
      });
    } else {
      response.answers = answers;
      response.remarks = remarks;
      response.attachments = attachmentRows;
      response.submittedAt = now;
      await response.save();
    }

    assignment.status = "submitted";
    assignment.submittedAt = now;
    assignment.response = response._id;
    assignment.lastViewedAt = now;
    await assignment.save();

    await PollNotification.updateMany(
      {
        employee: req.user.id,
        assignment: assignment._id,
        readAt: null,
      },
      { $set: { readAt: now } }
    );

    return res.json({
      message:
        assignment.poll.allowResubmission && normalizeText(req.body?.resubmit).toLowerCase()
          ? "Poll response updated successfully"
          : "Poll response submitted successfully",
    });
  } catch (err) {
    console.error("SUBMIT POLL RESPONSE ERROR:", err);
    return res.status(err.status || 500).json({
      message: err.message || "Failed to submit poll response",
    });
  }
};

exports.getPollReport = async (req, res) => {
  try {
    const poll = await ensurePollAccess({
      pollId: req.params.id,
      access: req.access || {},
      user: req.user,
    });

    if (!poll) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const [assignments, responses, companies] = await Promise.all([
      PollAssignment.find({
        poll: poll._id,
        status: { $ne: "revoked" },
      })
        .populate({
          path: "employee",
          select: "employeeCode employeeName email sites department",
          populate: [
            { path: "sites", select: "name companyName" },
            { path: "department", select: "name" },
          ],
        })
        .lean(),
      PollResponse.find({ poll: poll._id }).lean(),
      Company.find({}, "name").lean(),
    ]);

    const responseByAssignmentId = new Map(
      responses.map((response) => [normalizeId(response.assignment), response])
    );
    const companyByName = new Map(companies.map((company) => [normalizeText(company.name), company]));

    let reportRows = assignments
      .filter((assignment) => assignment.employee)
      .map((assignment) => {
        const response = responseByAssignmentId.get(normalizeId(assignment._id)) || null;
        const employeeMeta = buildReportEmployeeMeta(assignment.employee, companyByName);
        return {
          assignmentId: normalizeId(assignment._id),
          employeeId: employeeMeta.employeeId,
          employeeLabel: employeeMeta.employeeLabel,
          companyIds: employeeMeta.companyIds,
          companyLabels: employeeMeta.companyLabels,
          siteIds: employeeMeta.siteIds,
          siteLabels: employeeMeta.siteLabels,
          departmentIds: employeeMeta.departmentIds,
          departmentLabels: employeeMeta.departmentLabels,
          status: normalizeText(assignment.status).toLowerCase() || "not_answered",
          submittedAt: assignment.submittedAt || response?.submittedAt || null,
          response,
          answerRows: response ? mapReportAnswerRows(poll, response.answers) : [],
        };
      });

    const companyId = normalizeText(req.query?.companyId);
    const siteId = normalizeText(req.query?.siteId);
    const departmentId = normalizeText(req.query?.departmentId);
    const employeeId = normalizeText(req.query?.employeeId);
    const questionId = normalizeText(req.query?.questionId);
    const status = normalizeText(req.query?.status).toLowerCase();
    const search = normalizeText(req.query?.search);

    if (companyId) {
      reportRows = reportRows.filter((row) => row.companyIds.includes(companyId));
    }
    if (siteId) {
      reportRows = reportRows.filter((row) => row.siteIds.includes(siteId));
    }
    if (departmentId) {
      reportRows = reportRows.filter((row) => row.departmentIds.includes(departmentId));
    }
    if (employeeId) {
      reportRows = reportRows.filter((row) => row.employeeId === employeeId);
    }
    if (status && ["submitted", "not_answered"].includes(status)) {
      reportRows = reportRows.filter((row) => row.status === status);
    }
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      reportRows = reportRows.filter((row) => {
        const remarks = normalizeText(row.response?.remarks);
        return (
          searchRegex.test(row.employeeLabel || "") ||
          searchRegex.test(remarks) ||
          row.answerRows.some(
            (answerRow) =>
              searchRegex.test(answerRow.questionText || "") ||
              answerRow.selectedOptionTexts.some((optionText) => searchRegex.test(optionText || ""))
          )
        );
      });
    }

    const questions = Array.isArray(poll.questions) ? poll.questions : [];
    const filteredQuestions = questionId
      ? questions.filter((question) => normalizeId(question._id) === questionId)
      : questions;

    const questionResults = filteredQuestions.map((question) => {
      const optionCounts = new Map(
        (Array.isArray(question.options) ? question.options : []).map((option) => [
          normalizeId(option._id),
          {
            optionId: normalizeId(option._id),
            optionText: normalizeText(option.text),
            count: 0,
          },
        ])
      );
      let totalResponses = 0;

      reportRows.forEach((row) => {
        if (row.status !== "submitted") return;
        const answerRow = row.answerRows.find(
          (item) => normalizeId(item.questionId) === normalizeId(question._id)
        );
        if (!answerRow) return;

        totalResponses += 1;
        answerRow.selectedOptionIds.forEach((selectedOptionId) => {
          const optionRow = optionCounts.get(selectedOptionId);
          if (optionRow) {
            optionRow.count += 1;
          }
        });
      });

      return {
        questionId: normalizeId(question._id),
        questionText: normalizeText(question.questionText),
        responseType: normalizeText(question.responseType),
        totalResponses,
        optionCounts: Array.from(optionCounts.values()),
      };
    });

    const responseRows = reportRows.map((row) => ({
      assignmentId: row.assignmentId,
      employeeId: row.employeeId,
      employeeLabel: row.employeeLabel,
      companyLabels: row.companyLabels,
      siteLabels: row.siteLabels,
      departmentLabels: row.departmentLabels,
      status: row.status,
      submittedAt: row.submittedAt,
      remarks: normalizeText(row.response?.remarks),
      attachments: Array.isArray(row.response?.attachments) ? row.response.attachments : [],
      answers: questionId
        ? row.answerRows.filter((answerRow) => normalizeId(answerRow.questionId) === questionId)
        : row.answerRows,
    }));

    const companyOptions = Array.from(
      new Map(
        reportRows.flatMap((row) =>
          row.companyIds.map((mappedCompanyId, index) => [
            mappedCompanyId,
            {
              value: mappedCompanyId,
              label: row.companyLabels[index] || mappedCompanyId,
            },
          ])
        )
      ).values()
    ).sort((left, right) => left.label.localeCompare(right.label));

    const siteOptions = Array.from(
      new Map(
        reportRows.flatMap((row) =>
          row.siteIds.map((mappedSiteId, index) => [
            mappedSiteId,
            {
              value: mappedSiteId,
              label: row.siteLabels[index] || mappedSiteId,
            },
          ])
        )
      ).values()
    ).sort((left, right) => left.label.localeCompare(right.label));

    const departmentOptions = Array.from(
      new Map(
        reportRows.flatMap((row) =>
          row.departmentIds.map((mappedDepartmentId, index) => [
            mappedDepartmentId,
            {
              value: mappedDepartmentId,
              label: row.departmentLabels[index] || mappedDepartmentId,
            },
          ])
        )
      ).values()
    ).sort((left, right) => left.label.localeCompare(right.label));

    const employeeOptions = Array.from(
      new Map(
        reportRows.map((row) => [
          row.employeeId,
          {
            value: row.employeeId,
            label: row.employeeLabel,
          },
        ])
      ).values()
    ).sort((left, right) => left.label.localeCompare(right.label));

    return res.json({
      poll: {
        _id: poll._id,
        title: poll.title,
        description: poll.description || "",
        startDate: poll.startDate,
        endDate: poll.endDate,
        status: poll.status,
        scopeType: poll.scopeType,
      },
      summary: {
        totalResponses: reportRows.filter((row) => row.status === "submitted").length,
        pendingResponses: reportRows.filter((row) => row.status !== "submitted").length,
        totalAssignments: reportRows.length,
      },
      filterOptions: {
        companies: companyOptions,
        sites: siteOptions,
        departments: departmentOptions,
        employees: employeeOptions,
        questions: questions.map((question) => ({
          value: normalizeId(question._id),
          label: normalizeText(question.questionText),
        })),
      },
      questionResults,
      responseRows,
    });
  } catch (err) {
    console.error("GET POLL REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to load poll report" });
  }
};

exports.getMyPollNotifications = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view poll notifications" });
    }

    const unreadRows = await PollNotification.find({
      employee: req.user.id,
      readAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const unreadAssignmentIds = new Set(unreadRows.map((row) => normalizeId(row.assignment)));
    const reminderAssignments = await PollAssignment.find({
      employee: req.user.id,
      status: "not_answered",
    })
      .populate("poll")
      .sort({ assignedAt: -1 })
      .lean();

    const now = Date.now();
    const reminderRows = reminderAssignments
      .filter((assignment) => assignment.poll)
      .filter((assignment) => !unreadAssignmentIds.has(normalizeId(assignment._id)))
      .filter((assignment) => getPollWindowState(assignment.poll) === "active")
      .filter((assignment) => {
        const endAt = new Date(assignment.poll.endDate || 0).getTime();
        return Number.isFinite(endAt) && endAt >= now && endAt - now <= REMINDER_WINDOW_MS;
      })
      .slice(0, 10)
      .map((assignment) => ({
        _id: `reminder-${assignment._id}`,
        assignmentId: normalizeId(assignment._id),
        title: normalizeText(assignment.poll.title),
        message: `Response due by ${formatDateTime(assignment.poll.endDate)}.`,
        routePath: `/polls/my/${assignment._id}`,
        createdAt: assignment.poll.endDate,
      }));

    return res.json({
      counts: {
        unread: unreadRows.length,
        reminders: reminderRows.length,
        total: unreadRows.length + reminderRows.length,
      },
      unread: unreadRows.map((row) => ({
        _id: row._id,
        assignmentId: normalizeId(row.assignment),
        title: normalizeText(row.title),
        message: normalizeText(row.message),
        routePath: normalizeText(row.routePath),
        createdAt: row.createdAt || null,
      })),
      reminders: reminderRows,
    });
  } catch (err) {
    console.error("GET MY POLL NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load poll notifications" });
  }
};

exports.markPollNotificationRead = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can update poll notifications" });
    }

    const notification = await PollNotification.findOne({
      _id: req.params.id,
      employee: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Poll notification not found" });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.json({ message: "Poll notification marked as read" });
  } catch (err) {
    console.error("MARK POLL NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update poll notification" });
  }
};
