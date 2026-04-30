const { Types } = require("mongoose");
const Employee = require("../models/Employee");
const PersonalTask = require("../models/PersonalTask");
const {
  DEFAULT_NOTIFICATION_WINDOW_MS,
  getPersonalTaskNotificationState,
  isEmployeeRequester,
  mapPersonalTaskForResponse,
  validatePersonalTaskPayload,
} = require("../services/personalTask.service");

const normalizeText = (value) => String(value || "").trim();
const normalizeId = (value) => String(value?._id || value || "").trim();

const isValidObjectId = (value) => Types.ObjectId.isValid(String(value || "").trim());

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sortTasksForList = (rows = []) =>
  [...rows].sort((leftTask, rightTask) => {
    const leftStatusRank = leftTask.status === "pending" ? 0 : 1;
    const rightStatusRank = rightTask.status === "pending" ? 0 : 1;

    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank;
    }

    const leftTime = new Date(
      leftTask.nextReminderAt ||
        leftTask.lastTriggeredAt ||
        leftTask.scheduledAt ||
        leftTask.createdAt ||
        0
    ).getTime();
    const rightTime = new Date(
      rightTask.nextReminderAt ||
        rightTask.lastTriggeredAt ||
        rightTask.scheduledAt ||
        rightTask.createdAt ||
        0
    ).getTime();

    if (leftTask.status === "pending") {
      return leftTime - rightTime;
    }

    return rightTime - leftTime;
  });

const populatePersonalTaskQuery = (query) =>
  query
    .populate("employee", "employeeCode employeeName email")
    .populate("assignedEmployee", "employeeCode employeeName email")
    .populate("completedBy", "employeeCode employeeName email");

const buildVisibleTaskFilter = (employeeId) => ({
  $or: [{ employee: employeeId }, { assignedEmployee: employeeId }],
});

const buildAssignedTaskFilter = (employeeId) => ({
  $or: [
    { assignedEmployee: employeeId },
    { assignedEmployee: null, employee: employeeId },
  ],
});

const findVisibleTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      ...buildVisibleTaskFilter(employeeId),
    })
  );
};

const findCreatorTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      employee: employeeId,
    })
  );
};

const findAssignedTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      ...buildAssignedTaskFilter(employeeId),
    })
  );
};

const mapTaskForViewer = (task, employeeId) =>
  mapPersonalTaskForResponse(task, {
    viewerEmployeeId: employeeId,
  });

const mapShareableEmployee = (employee) => ({
  _id: normalizeId(employee),
  employeeCode: normalizeText(employee?.employeeCode),
  employeeName: normalizeText(employee?.employeeName),
  email: normalizeText(employee?.email),
  displayName:
    normalizeText(employee?.employeeCode) && normalizeText(employee?.employeeName)
      ? `${normalizeText(employee.employeeCode)} - ${normalizeText(employee.employeeName)}`
      : normalizeText(employee?.employeeCode) || normalizeText(employee?.employeeName),
});

exports.getMyPersonalTasks = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view personal reminders" });
    }

    const status = normalizeText(req.query?.status).toLowerCase();
    const search = normalizeText(req.query?.search);
    const filterClauses = [buildVisibleTaskFilter(req.user.id)];

    if (status) {
      filterClauses.push({ status });
    }

    if (search) {
      filterClauses.push({
        $or: [
          { title: { $regex: escapeRegex(search), $options: "i" } },
          { description: { $regex: escapeRegex(search), $options: "i" } },
        ],
      });
    }

    const filter =
      filterClauses.length === 1 ? filterClauses[0] : { $and: filterClauses };

    const rows = await populatePersonalTaskQuery(PersonalTask.find(filter).sort({ createdAt: -1 }));
    const mappedRows = sortTasksForList(
      rows.map((row) => mapTaskForViewer(row, req.user.id))
    );

    return res.json(mappedRows);
  } catch (err) {
    console.error("GET MY PERSONAL TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load personal reminders" });
  }
};

exports.getPersonalTaskById = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view personal reminders" });
    }

    const task = await findVisibleTaskById(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({ message: "Personal reminder not found" });
    }

    return res.json(mapTaskForViewer(task, req.user.id));
  } catch (err) {
    console.error("GET PERSONAL TASK BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load personal reminder" });
  }
};

exports.getShareableEmployees = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can share personal reminders" });
    }

    const search = normalizeText(req.query?.search);
    const filter = {
      isActive: true,
    };

    if (search) {
      filter.$or = [
        { employeeCode: { $regex: escapeRegex(search), $options: "i" } },
        { employeeName: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const rows = await Employee.find(
      filter,
      "employeeCode employeeName email"
    ).sort({ employeeName: 1, employeeCode: 1 });

    return res.json(rows.map((employee) => mapShareableEmployee(employee)));
  } catch (err) {
    console.error("GET SHAREABLE EMPLOYEES ERROR:", err);
    return res.status(500).json({ message: "Failed to load employees" });
  }
};

exports.createPersonalTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can create personal reminders" });
    }

    const validationResult = await validatePersonalTaskPayload({
      body: req.body,
      employeeId: req.user.id,
      file: req.file,
    });

    if (validationResult.message) {
      return res
        .status(validationResult.status || 400)
        .json({ message: validationResult.message });
    }

    const task = await PersonalTask.create(validationResult.payload);
    const hydratedTask = await populatePersonalTaskQuery(PersonalTask.findById(task._id));

    return res.status(201).json({
      message: "Personal reminder created successfully",
      task: mapTaskForViewer(hydratedTask, req.user.id),
    });
  } catch (err) {
    console.error("CREATE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to create personal reminder" });
  }
};

exports.sharePersonalTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can share personal reminders" });
    }

    const assignedEmployeeId = normalizeText(
      req.body?.assignedEmployeeId || req.body?.employeeId
    );

    if (!isValidObjectId(assignedEmployeeId)) {
      return res.status(400).json({ message: "Select a valid employee" });
    }

    const task = await findCreatorTaskById(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({ message: "Personal reminder not found" });
    }

    if (task.status === "completed") {
      return res.status(400).json({ message: "Completed tasks cannot be reassigned" });
    }

    const assignedEmployee = await Employee.findOne(
      {
        _id: assignedEmployeeId,
        isActive: true,
      },
      "employeeCode employeeName email"
    );

    if (!assignedEmployee) {
      return res.status(400).json({ message: "Selected employee is invalid" });
    }

    const isAssigningBackToCreator = normalizeId(assignedEmployee) === normalizeId(task.employee);

    task.assignedEmployee = assignedEmployee._id;
    task.sharedAt = isAssigningBackToCreator ? null : new Date();
    task.completedAt = null;
    task.completedBy = null;
    task.lastNotificationReadAt = null;
    await task.save();

    await task.populate("assignedEmployee", "employeeCode employeeName email");

    return res.json({
      message: isAssigningBackToCreator
        ? "Task assigned back to you"
        : "Task shared successfully",
      task: mapTaskForViewer(task, req.user.id),
    });
  } catch (err) {
    console.error("SHARE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to share personal reminder" });
  }
};

exports.completePersonalTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can complete personal reminders" });
    }

    const task = await findAssignedTaskById(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({ message: "Personal reminder not found" });
    }

    if (task.status === "completed") {
      return res.json({
        message: "Personal reminder already completed",
        task: mapTaskForViewer(task, req.user.id),
      });
    }

    const now = new Date();
    task.status = "completed";
    task.completedAt = now;
    task.completedBy = req.user.id;
    task.nextReminderAt = null;
    task.lastNotificationReadAt = now;
    await task.save();
    await task.populate("completedBy", "employeeCode employeeName email");

    return res.json({
      message: "Personal reminder marked as completed",
      task: mapTaskForViewer(task, req.user.id),
    });
  } catch (err) {
    console.error("COMPLETE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to complete personal reminder" });
  }
};

exports.markPersonalTaskNotificationRead = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can update reminder notifications" });
    }

    const task = await findAssignedTaskById(req.params.id, req.user.id);

    if (!task) {
      return res.status(404).json({ message: "Personal reminder not found" });
    }

    const notificationState = getPersonalTaskNotificationState(
      task,
      new Date(),
      DEFAULT_NOTIFICATION_WINDOW_MS,
      req.user.id
    );

    if (notificationState.hasUnreadNotification) {
      task.lastNotificationReadAt = new Date();
      await task.save();
    }

    return res.json({
      message: "Reminder notification updated",
      task: mapTaskForViewer(task, req.user.id),
    });
  } catch (err) {
    console.error("MARK PERSONAL TASK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update reminder notification" });
  }
};

exports.getMyPersonalTaskNotifications = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view reminder notifications" });
    }

    const rows = await populatePersonalTaskQuery(
      PersonalTask.find({
        status: "pending",
        ...buildAssignedTaskFilter(req.user.id),
      }).sort({ nextReminderAt: 1, createdAt: -1 })
    );
    const due = [];
    const upcoming = [];

    for (const row of rows) {
      const mappedRow = mapTaskForViewer(row, req.user.id);

      if (mappedRow.notificationState === "due") {
        due.push(mappedRow);
      } else if (mappedRow.notificationState === "upcoming") {
        upcoming.push(mappedRow);
      }
    }

    due.sort(
      (leftTask, rightTask) =>
        new Date(rightTask.notificationAt || 0).getTime() -
        new Date(leftTask.notificationAt || 0).getTime()
    );
    upcoming.sort(
      (leftTask, rightTask) =>
        new Date(leftTask.notificationAt || 0).getTime() -
        new Date(rightTask.notificationAt || 0).getTime()
    );

    return res.json({
      counts: {
        due: due.length,
        upcoming: upcoming.length,
        total: due.length + upcoming.length,
      },
      due,
      upcoming,
    });
  } catch (err) {
    console.error("GET PERSONAL TASK NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load reminder notifications" });
  }
};
