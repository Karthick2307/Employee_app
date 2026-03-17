const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const {
  TASK_STATUSES,
  TASK_TIMELINESS_STATUSES,
  applyChecklistDecision,
  applyTaskSubmission,
  canAccessChecklistTask,
  checklistPopulateQuery,
  checklistTaskPopulateQuery,
  getNextChecklistNumberValue,
  isAdminRequester,
  isEmployeeRequester,
  isValidObjectId,
  parseDateBoundary,
  runChecklistScheduler,
  validateChecklistPayload,
} = require("../services/checklistWorkflow.service");

const normalizeText = (value) => String(value || "").trim();

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getChecklistFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const status = normalizeText(query.status).toLowerCase();
  const assignedToEmployee = normalizeText(query.assignedToEmployee);
  const filter = {};

  if (search) {
    filter.$or = [
      { checklistNumber: { $regex: search, $options: "i" } },
      { checklistName: { $regex: search, $options: "i" } },
    ];
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (status === "active") {
    filter.status = true;
  }

  if (status === "inactive") {
    filter.status = false;
  }

  if (assignedToEmployee) {
    filter.assignedToEmployee = assignedToEmployee;
  }

  return filter;
};

const getTaskFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const status = normalizeText(query.status).toLowerCase();
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const timelinessStatus = normalizeText(query.timelinessStatus).toLowerCase();
  const filter = {};

  if (search) {
    filter.$or = [
      { taskNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistName: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  if (status) {
    filter.status = status;
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (TASK_TIMELINESS_STATUSES.includes(timelinessStatus)) {
    filter.timelinessStatus = timelinessStatus;
  }

  return filter;
};

exports.getChecklists = async (req, res) => {
  try {
    if (!isAdminRequester(req.user)) {
      return res.status(403).json({ message: "Only admins can view checklist master data" });
    }

    const filter = getChecklistFilters(req.query);
    const checklists = await Checklist.find(filter)
      .populate(checklistPopulateQuery)
      .sort({ createdAt: -1 });

    return res.json(checklists);
  } catch (err) {
    console.error("GET CHECKLISTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist master data" });
  }
};

exports.getNextChecklistNumber = async (req, res) => {
  try {
    const employeeAssignedSite = normalizeText(req.query.employeeAssignedSite);

    if (!isValidObjectId(employeeAssignedSite)) {
      return res.status(400).json({
        message: "A valid assigned site is required to generate checklist number",
      });
    }

    const checklistNumber = await getNextChecklistNumberValue(employeeAssignedSite);

    if (!checklistNumber) {
      return res.status(404).json({ message: "Selected assigned site was not found" });
    }

    return res.json({ checklistNumber });
  } catch (err) {
    console.error("GET NEXT CHECKLIST NUMBER ERROR:", err);
    return res.status(500).json({ message: "Failed to generate checklist number" });
  }
};

exports.getChecklistById = async (req, res) => {
  try {
    if (!isAdminRequester(req.user)) {
      return res.status(403).json({ message: "Only admins can view checklist master data" });
    }

    const checklist = await Checklist.findById(req.params.id).populate(checklistPopulateQuery);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    return res.json(checklist);
  } catch (err) {
    console.error("GET CHECKLIST BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist master data" });
  }
};

exports.createChecklist = async (req, res) => {
  try {
    const validationResult = await validateChecklistPayload({ body: req.body });

    if (validationResult.message) {
      return res
        .status(validationResult.status || 400)
        .json({ message: validationResult.message });
    }

    const checklist = await Checklist.create({
      ...validationResult.payload,
      createdBy: req.user?.id || null,
    });

    await runChecklistScheduler({ checklistIds: [checklist._id] });

    const populatedChecklist = await Checklist.findById(checklist._id).populate(
      checklistPopulateQuery
    );

    return res.status(201).json({
      message: "Checklist master created successfully",
      checklist: populatedChecklist,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Checklist number already exists" });
    }

    console.error("CREATE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to create checklist master" });
  }
};

exports.updateChecklist = async (req, res) => {
  try {
    if (!isAdminRequester(req.user)) {
      return res.status(403).json({ message: "Only admins can update checklist master data" });
    }

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    const validationResult = await validateChecklistPayload({ body: req.body });

    if (validationResult.message) {
      return res
        .status(validationResult.status || 400)
        .json({ message: validationResult.message });
    }

    const latestTask = await ChecklistTask.findOne({ checklist: checklist._id })
      .sort({ occurrenceDate: -1 })
      .lean();

    Object.assign(checklist, validationResult.payload, {
      lastGeneratedAt: latestTask?.occurrenceDate || null,
    });
    await checklist.save();
    await runChecklistScheduler({ checklistIds: [checklist._id] });

    const updatedChecklist = await Checklist.findById(checklist._id).populate(
      checklistPopulateQuery
    );

    return res.json({
      message: "Checklist master updated successfully",
      checklist: updatedChecklist,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Checklist number already exists" });
    }

    console.error("UPDATE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist master" });
  }
};

exports.toggleChecklistStatus = async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    checklist.status = !checklist.status;
    await checklist.save();

    if (checklist.status) {
      await runChecklistScheduler({ checklistIds: [checklist._id] });
    }

    return res.json({
      success: true,
      status: checklist.status,
    });
  } catch (err) {
    console.error("TOGGLE CHECKLIST STATUS ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist status" });
  }
};

exports.deleteChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findByIdAndDelete(req.params.id);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    await ChecklistTask.deleteMany({ checklist: checklist._id });

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to delete checklist master" });
  }
};

exports.getMyChecklistTasks = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view assigned checklist tasks" });
    }

    const filter = {
      ...getTaskFilters(req.query),
      assignedEmployee: req.user.id,
    };

    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: -1, createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET MY CHECKLIST TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load assigned checklist tasks" });
  }
};

exports.getApprovalTasks = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view checklist approvals" });
    }

    const filter = {
      ...getTaskFilters(req.query),
      status: "submitted",
      currentApprovalEmployee: req.user.id,
    };

    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ submittedAt: -1, occurrenceDate: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET APPROVAL TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load approval tasks" });
  }
};

exports.getChecklistTaskById = async (req, res) => {
  try {
    const task = await ChecklistTask.findById(req.params.id).populate(
      checklistTaskPopulateQuery
    );

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (!canAccessChecklistTask(task, req.user)) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    return res.json(task);
  } catch (err) {
    console.error("GET CHECKLIST TASK BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task" });
  }
};

exports.submitChecklistTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can submit checklist tasks" });
    }

    const task = await ChecklistTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (String(task.assignedEmployee) !== String(req.user.id)) {
      return res.status(403).json({ message: "This checklist is not assigned to you" });
    }

    if (task.status !== "open") {
      return res.status(400).json({ message: "Only open checklist tasks can be submitted" });
    }

    const submissionResult = applyTaskSubmission({
      task,
      body: req.body,
      files: req.files,
    });

    if (submissionResult.message) {
      return res
        .status(submissionResult.status || 400)
        .json({ message: submissionResult.message });
    }

    await task.save();

    const populatedTask = await ChecklistTask.findById(task._id).populate(
      checklistTaskPopulateQuery
    );

    return res.json({
      message: "Checklist task submitted successfully",
      task: populatedTask,
    });
  } catch (err) {
    console.error("SUBMIT CHECKLIST TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to submit checklist task" });
  }
};

exports.decideChecklistTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only approvers can action checklist tasks" });
    }

    const task = await ChecklistTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (String(task.currentApprovalEmployee || "") !== String(req.user.id)) {
      return res.status(403).json({
        message: "This approval request is not mapped to your employee account",
      });
    }

    if (task.status !== "submitted") {
      return res.status(400).json({ message: "Only submitted checklist tasks can be actioned" });
    }

    const decisionResult = applyChecklistDecision({
      task,
      action: req.body.action,
      remarks: req.body.remarks,
    });

    if (decisionResult.message) {
      return res
        .status(decisionResult.status || 400)
        .json({ message: decisionResult.message });
    }

    await task.save();

    const populatedTask = await ChecklistTask.findById(task._id).populate(
      checklistTaskPopulateQuery
    );

    return res.json({
      message: "Checklist approval updated successfully",
      task: populatedTask,
    });
  } catch (err) {
    console.error("DECIDE CHECKLIST TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist approval" });
  }
};

exports.getChecklistTaskReport = async (req, res) => {
  try {
    if (!isAdminRequester(req.user)) {
      return res.status(403).json({ message: "Only admins can view checklist task reports" });
    }

    const filter = getTaskFilters(req.query);
    const assignedEmployee = normalizeText(req.query.assignedEmployee);
    const approverEmployee = normalizeText(req.query.approverEmployee);
    const fromDateRaw = normalizeText(req.query.fromDate);
    const toDateRaw = normalizeText(req.query.toDate);

    if (assignedEmployee) {
      filter.assignedEmployee = assignedEmployee;
    }

    if (approverEmployee) {
      filter.currentApprovalEmployee = approverEmployee;
    }

    const fromDate = parseDateBoundary(fromDateRaw, "start");
    const toDate = parseDateBoundary(toDateRaw, "end");

    if (fromDateRaw && !fromDate) {
      return res.status(400).json({ message: "Invalid from date filter" });
    }

    if (toDateRaw && !toDate) {
      return res.status(400).json({ message: "Invalid to date filter" });
    }

    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ message: "From date cannot be greater than to date" });
    }

    if (fromDate || toDate) {
      filter.occurrenceDate = {};
      if (fromDate) filter.occurrenceDate.$gte = fromDate;
      if (toDate) filter.occurrenceDate.$lte = toDate;
    }

    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: -1, createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET CHECKLIST TASK REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task report" });
  }
};

exports.runSchedulerManually = async (req, res) => {
  try {
    const result = await runChecklistScheduler();
    return res.json({
      message: "Checklist scheduler executed",
      ...result,
    });
  } catch (err) {
    console.error("RUN CHECKLIST SCHEDULER ERROR:", err);
    return res.status(500).json({ message: "Failed to run checklist scheduler" });
  }
};
