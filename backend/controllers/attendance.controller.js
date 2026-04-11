const ExcelJS = require("exceljs");
const AttendanceRecord = require("../models/AttendanceRecord");
const AttendanceRegularizationRequest = require("../models/AttendanceRegularizationRequest");
const AttendanceSetting = require("../models/AttendanceSetting");
const {
  buildActor,
  buildAttendanceEmployeeFilter,
  buildBreakdownRows,
  buildDateTime,
  buildRecordFilter,
  countStatusRows,
  formatDateLabel,
  formatEmployeeDisplayName,
  formatSiteDisplayName,
  getAttendanceEmployees,
  getAttendanceSettings,
  getDateKey,
  getDateRangeFromQuery,
  getMonthDateRange,
  getRegularizationStatusLabel,
  getStatusLabel,
  isLateStatusMatch,
  mapAttendanceRecord,
  mergeDailyAttendanceRows,
  normalizeId,
  normalizeStatusKey,
  prepareAttendanceRecordPayload,
  startOfDay,
  toLocalDate,
  uniqueIdList,
} = require("../services/attendance.service");

const normalizeText = (value) => String(value || "").trim();

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((row) => {
    const nextTrail = [...trail, normalizeText(row?.name)];

    return [
      {
        value: normalizeId(row?._id),
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
        departmentId: normalizeId(department?._id),
      },
      ...flattenSubDepartments(row.children || [], nextTrail, department),
    ];
  });

const validateTimeValue = (value, label) => {
  const rawValue = normalizeText(value);
  if (!rawValue) return;

  if (!/^(\d{2}):(\d{2})$/.test(rawValue)) {
    const error = new Error(`${label} must be in HH:mm format`);
    error.status = 400;
    throw error;
  }
};

const handleControllerError = (res, err, fallbackMessage) => {
  if (err?.code === 11000) {
    return res.status(400).json({ message: "Attendance already exists for this employee and date" });
  }

  return res.status(err?.status || 500).json({
    message: err?.message || fallbackMessage,
  });
};

const findAccessibleEmployee = async (access, employeeId) => {
  const employees = await getAttendanceEmployees(
    access,
    { employeeId },
    { includeInactive: true }
  );
  const employee = employees.find((item) => normalizeId(item?._id) === normalizeId(employeeId));

  if (!employee) {
    const error = new Error("Employee not found or not available in your attendance scope");
    error.status = 404;
    throw error;
  }

  return employee;
};

const saveAttendanceDocument = async (existingRecord, payload) => {
  if (existingRecord) {
    Object.assign(existingRecord, payload);
    await existingRecord.save();
    return existingRecord;
  }

  const createdRecord = await AttendanceRecord.create(payload);
  return createdRecord;
};

const buildOptionsFromEmployees = (employees = []) => {
  const companyMap = new Map();
  const siteMap = new Map();
  const departmentMap = new Map();
  const subDepartmentMap = new Map();

  employees.forEach((employee) => {
    (employee.sites || []).forEach((site) => {
      const companyName = normalizeText(site?.companyName);
      if (companyName && !companyMap.has(companyName)) {
        companyMap.set(companyName, {
          value: companyName,
          label: companyName,
        });
      }

      const siteId = normalizeId(site?._id);
      if (siteId && !siteMap.has(siteId)) {
        siteMap.set(siteId, {
          value: siteId,
          label: formatSiteDisplayName(site),
          companyName,
        });
      }
    });

    (employee.department || []).forEach((department) => {
      const departmentId = normalizeId(department?._id);

      if (departmentId && !departmentMap.has(departmentId)) {
        departmentMap.set(departmentId, {
          value: departmentId,
          label: normalizeText(department?.name),
        });
      }

      flattenSubDepartments(department.subDepartments || [], [], department).forEach(
        (subDepartment) => {
          if (!subDepartmentMap.has(subDepartment.value)) {
            subDepartmentMap.set(subDepartment.value, subDepartment);
          }
        }
      );
    });
  });

  return {
    companies: [...companyMap.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
    ),
    sites: [...siteMap.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
    ),
    departments: [...departmentMap.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
    ),
    subDepartments: [...subDepartmentMap.values()].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" })
    ),
    employees: employees.map((employee) => ({
      value: normalizeId(employee?._id),
      label: formatEmployeeDisplayName(employee),
      employeeCode: normalizeText(employee?.employeeCode),
      employeeName: normalizeText(employee?.employeeName),
      companyNames: [...new Set((employee.sites || []).map((site) => normalizeText(site?.companyName)).filter(Boolean))],
      sites: (employee.sites || []).map((site) => normalizeId(site?._id)),
      departments: (employee.department || []).map((department) => normalizeId(department?._id)),
      subDepartments: uniqueIdList(employee.subDepartment),
    })),
  };
};

const applyRowSearch = (rows = [], searchValue = "") => {
  const normalizedSearch = normalizeText(searchValue).toLowerCase();
  if (!normalizedSearch) return rows;

  return rows.filter((row) =>
    [
      row.employeeCode,
      row.employeeName,
      row.employeeDisplayName,
      row.departmentName,
      row.subDepartmentName,
      row.siteName,
      row.companyName,
      row.reportingHeadName,
      row.statusLabel,
      row.status,
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .some((value) => value.includes(normalizedSearch))
  );
};

const buildAttendanceDashboardData = async (access, query = {}) => {
  const settings = await getAttendanceSettings();
  const { singleDate, fromDate, toDate, dateKey } = getDateRangeFromQuery(query, {
    defaultToToday: true,
  });
  const targetDate = singleDate || startOfDay(fromDate) || startOfDay(new Date());
  const employees = await getAttendanceEmployees(access, query, { includeInactive: false });
  const employeeIds = employees.map((employee) => employee._id);
  const rangeStart = singleDate ? startOfDay(targetDate) : fromDate;
  const rangeEnd = singleDate
    ? new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999)
    : toDate;
  const records = await AttendanceRecord.find(
    buildRecordFilter({
      employeeIds,
      fromDate: rangeStart,
      toDate: rangeEnd,
      filters: query,
    })
  )
    .sort({ employeeName: 1 })
    .lean();

  const rows = mergeDailyAttendanceRows({
    employees,
    records,
    attendanceDate: targetDate,
    settings,
    statusFilter: query.status || "",
  });
  const searchedRows = applyRowSearch(rows, query.search || "");
  const counts = countStatusRows(searchedRows);

  return {
    settings,
    dateKey: dateKey || getDateKey(targetDate),
    dateLabel: formatDateLabel(targetDate),
    employeesInScope: employees.length,
    cards: {
      presentCount: counts.present,
      absentCount: counts.absent,
      halfDayCount: counts.half_day,
      leaveCount: counts.leave,
      lateCount: counts.lateDerived,
      onDutyCount: counts.on_duty,
      pendingCount: counts.pending,
      missingCheckOutCount: counts.missingCheckOut,
    },
    siteWise: buildBreakdownRows(searchedRows, "siteId", "siteDisplayName"),
    departmentWise: buildBreakdownRows(searchedRows, "departmentId", "departmentName"),
    employeeWise: searchedRows.slice(0, 200),
    alertRows: searchedRows.filter(
      (row) =>
        row.missingCheckOut ||
        isLateStatusMatch(row) ||
        normalizeStatusKey(row.status) === "absent"
    ),
  };
};

const buildMonthlyReportRows = async (access, query = {}) => {
  const settings = await getAttendanceSettings();
  const { fromDate, toDate } = getMonthDateRange(query.month || getDateKey(new Date()).slice(0, 7));
  const employees = await getAttendanceEmployees(access, query, { includeInactive: false });
  const employeeIds = employees.map((employee) => employee._id);
  const records = await AttendanceRecord.find(
    buildRecordFilter({
      employeeIds,
      fromDate,
      toDate,
      filters: {
        companyName: query.companyName,
        siteId: query.siteId,
        departmentId: query.departmentId,
        subDepartmentId: query.subDepartmentId,
      },
    })
  )
    .sort({ attendanceDate: 1, employeeName: 1 })
    .lean();

  const recordsByEmployeeId = records.reduce((result, record) => {
    const key = normalizeId(record.employeeId);
    if (!result.has(key)) {
      result.set(key, []);
    }

    result.get(key).push(mapAttendanceRecord(record));
    return result;
  }, new Map());

  const totalDaysInMonth =
    Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

  const rows = employees.map((employee) => {
    const employeeId = normalizeId(employee?._id);
    const employeeRows = recordsByEmployeeId.get(employeeId) || [];
    const counts = countStatusRows(employeeRows);
    const nonOffRecordedDays = new Set(
      employeeRows
        .filter((row) => !["week_off", "holiday"].includes(normalizeStatusKey(row.status)))
        .map((row) => row.attendanceDateKey)
    ).size;
    const workingDays = Math.max(0, totalDaysInMonth - counts.week_off - counts.holiday);
    const derivedMissingDays = Math.max(0, workingDays - nonOffRecordedDays);
    const derivedAbsentDays =
      normalizeStatusKey(settings.missingCheckInStatus) === "absent" ? derivedMissingDays : 0;
    const derivedPendingDays =
      normalizeStatusKey(settings.missingCheckInStatus) === "pending"
        ? derivedMissingDays
        : 0;
    const presentEquivalentDays = counts.present + counts.late + counts.on_duty;

    return {
      employeeId,
      employeeCode: normalizeText(employee?.employeeCode),
      employeeName: normalizeText(employee?.employeeName),
      employeeDisplayName: formatEmployeeDisplayName(employee),
      companyName: normalizeText(employee?.sites?.[0]?.companyName),
      siteName: normalizeText(employee?.sites?.[0]?.name),
      departmentName: normalizeText(employee?.department?.[0]?.name),
      reportingHeadName: formatEmployeeDisplayName(employee?.superiorEmployee),
      workingDays,
      totalPresentDays: presentEquivalentDays,
      totalAbsentDays: counts.absent + derivedAbsentDays,
      totalLeaveDays: counts.leave,
      totalHalfDays: counts.half_day,
      totalLateDays: counts.lateDerived,
      totalWeekOffDays: counts.week_off,
      totalHolidayDays: counts.holiday,
      totalOnDutyDays: counts.on_duty,
      totalPendingDays: counts.pending + derivedPendingDays,
    };
  });

  const searchedRows = applyRowSearch(rows, query.search || "");
  const summary = searchedRows.reduce(
    (result, row) => {
      result.totalEmployees += 1;
      result.totalPresentDays += row.totalPresentDays;
      result.totalAbsentDays += row.totalAbsentDays;
      result.totalLeaveDays += row.totalLeaveDays;
      result.totalHalfDays += row.totalHalfDays;
      result.totalLateDays += row.totalLateDays;
      result.totalWeekOffDays += row.totalWeekOffDays;
      result.totalHolidayDays += row.totalHolidayDays;
      result.totalOnDutyDays += row.totalOnDutyDays;
      result.totalPendingDays += row.totalPendingDays;
      return result;
    },
    {
      totalEmployees: 0,
      totalPresentDays: 0,
      totalAbsentDays: 0,
      totalLeaveDays: 0,
      totalHalfDays: 0,
      totalLateDays: 0,
      totalWeekOffDays: 0,
      totalHolidayDays: 0,
      totalOnDutyDays: 0,
      totalPendingDays: 0,
    }
  );

  return {
    settings,
    month: `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`,
    fromDate,
    toDate,
    rows: searchedRows,
    summary,
  };
};

exports.getAttendanceOptions = async (req, res) => {
  try {
    const settings = await getAttendanceSettings();
    const employees = await getAttendanceEmployees(req.access || {}, req.query || {}, {
      includeInactive: false,
    });

    res.json({
      settings,
      ...buildOptionsFromEmployees(employees),
      statuses: Object.entries({
        present: "Present",
        absent: "Absent",
        half_day: "Half Day",
        leave: "Leave",
        week_off: "Week Off",
        holiday: "Holiday",
        late: "Late",
        on_duty: "On Duty / Field Work",
        pending: "Pending",
      }).map(([value, label]) => ({
        value,
        label,
      })),
      currentPrincipalEmployeeId:
        req.user?.principalType === "employee" ? normalizeId(req.user?.id) : "",
    });
  } catch (err) {
    console.error("Attendance options error:", err);
    handleControllerError(res, err, "Failed to load attendance filters");
  }
};

exports.getAttendanceDashboard = async (req, res) => {
  try {
    const result = await buildAttendanceDashboardData(req.access || {}, req.query || {});
    res.json(result);
  } catch (err) {
    console.error("Attendance dashboard error:", err);
    handleControllerError(res, err, "Failed to load attendance dashboard");
  }
};

exports.getAttendanceRecords = async (req, res) => {
  try {
    const settings = await getAttendanceSettings();
    const { singleDate, fromDate, toDate } = getDateRangeFromQuery(req.query || {}, {
      defaultToToday: true,
    });
    const employees = await getAttendanceEmployees(req.access || {}, req.query || {}, {
      includeInactive: false,
    });
    const employeeIds = employees.map((employee) => employee._id);
    const records = await AttendanceRecord.find(
      buildRecordFilter({
        employeeIds,
        fromDate,
        toDate,
        filters: req.query || {},
      })
    )
      .sort({ attendanceDate: -1, employeeName: 1 })
      .lean();
    const shouldIncludeMissing =
      singleDate && String(req.query.includeMissing || "").trim().toLowerCase() !== "false";

    let rows = shouldIncludeMissing
      ? mergeDailyAttendanceRows({
          employees,
          records,
          attendanceDate: singleDate,
          settings,
          statusFilter: req.query.status || "",
        })
      : records.map(mapAttendanceRecord);

    if (!shouldIncludeMissing && normalizeStatusKey(req.query.status) === "late") {
      rows = rows.filter((row) => isLateStatusMatch(row));
    }

    rows = applyRowSearch(rows, req.query.search || "");

    res.json({
      rows,
      meta: {
        total: rows.length,
        includeMissing: shouldIncludeMissing,
        fromDate: fromDate ? getDateKey(fromDate) : "",
        toDate: toDate ? getDateKey(toDate) : "",
        singleDate: singleDate ? getDateKey(singleDate) : "",
      },
    });
  } catch (err) {
    console.error("Attendance records error:", err);
    handleControllerError(res, err, "Failed to load attendance records");
  }
};

exports.createOrUpdateAttendanceRecord = async (req, res) => {
  try {
    const employeeId = normalizeText(req.body.employeeId);
    const attendanceDate = normalizeText(req.body.attendanceDate);

    if (!employeeId) {
      return res.status(400).json({ message: "Employee is required" });
    }

    if (!attendanceDate) {
      return res.status(400).json({ message: "Attendance date is required" });
    }

    const settings = await getAttendanceSettings();
    const employee = await findAccessibleEmployee(req.access || {}, employeeId);
    const attendanceDateKey = getDateKey(attendanceDate);
    const existingRecord = await AttendanceRecord.findOne({
      employeeId,
      attendanceDateKey,
    });
    const payload = await prepareAttendanceRecordPayload({
      employee,
      existingRecord,
      input: {
        attendanceDate,
        checkInTime: req.body.checkInTime,
        checkOutTime: req.body.checkOutTime,
        status: req.body.status,
        remarks: req.body.remarks,
        siteId: req.body.siteId,
        departmentId: req.body.departmentId,
        subDepartmentId: req.body.subDepartmentId,
        entryMethod: "manual",
      },
      settings,
      actor: buildActor(req.user),
      entryMethod: "manual",
    });
    const savedRecord = await saveAttendanceDocument(existingRecord, payload);

    res.json({
      success: true,
      message: existingRecord
        ? "Attendance updated successfully"
        : "Attendance recorded successfully",
      record: mapAttendanceRecord(savedRecord),
    });
  } catch (err) {
    console.error("Save attendance record error:", err);
    handleControllerError(res, err, "Failed to save attendance");
  }
};

exports.updateAttendanceRecord = async (req, res) => {
  try {
    const existingRecord = await AttendanceRecord.findById(req.params.id);

    if (!existingRecord) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const employee = await findAccessibleEmployee(req.access || {}, existingRecord.employeeId);
    const settings = await getAttendanceSettings();
    const payload = await prepareAttendanceRecordPayload({
      employee,
      existingRecord,
      input: {
        attendanceDate: req.body.attendanceDate || existingRecord.attendanceDateKey,
        checkInTime: Object.prototype.hasOwnProperty.call(req.body, "checkInTime")
          ? req.body.checkInTime
          : existingRecord.checkInTime,
        checkOutTime: Object.prototype.hasOwnProperty.call(req.body, "checkOutTime")
          ? req.body.checkOutTime
          : existingRecord.checkOutTime,
        status: req.body.status || existingRecord.status,
        remarks: Object.prototype.hasOwnProperty.call(req.body, "remarks")
          ? req.body.remarks
          : existingRecord.remarks,
        siteId: req.body.siteId || existingRecord.siteId,
        departmentId: req.body.departmentId || existingRecord.departmentId,
        subDepartmentId: req.body.subDepartmentId || existingRecord.subDepartmentId,
        entryMethod: existingRecord.entryMethod || "manual",
      },
      settings,
      actor: buildActor(req.user),
      entryMethod: existingRecord.entryMethod || "manual",
    });
    const savedRecord = await saveAttendanceDocument(existingRecord, payload);

    res.json({
      success: true,
      message: "Attendance record updated successfully",
      record: mapAttendanceRecord(savedRecord),
    });
  } catch (err) {
    console.error("Update attendance record error:", err);
    handleControllerError(res, err, "Failed to update attendance");
  }
};

exports.getSelfAttendance = async (req, res) => {
  try {
    if (req.user?.principalType !== "employee") {
      return res.status(403).json({ message: "Self attendance is available only for employees" });
    }

    const settings = await getAttendanceSettings();
    const employee = await findAccessibleEmployee(req.access || {}, req.user.id);
    const todayKey = getDateKey(new Date());
    const todayRecord = await AttendanceRecord.findOne({
      employeeId: req.user.id,
      attendanceDateKey: todayKey,
    }).lean();
    const recentRecords = await AttendanceRecord.find({
      employeeId: req.user.id,
    })
      .sort({ attendanceDate: -1 })
      .limit(15)
      .lean();

    res.json({
      settings,
      employee: {
        id: normalizeId(employee?._id),
        employeeCode: normalizeText(employee?.employeeCode),
        employeeName: normalizeText(employee?.employeeName),
        displayName: formatEmployeeDisplayName(employee),
      },
      todayRecord: todayRecord
        ? mapAttendanceRecord(todayRecord)
        : mergeDailyAttendanceRows({
            employees: [employee],
            records: [],
            attendanceDate: new Date(),
            settings,
          })[0] || null,
      recentRecords: recentRecords.map(mapAttendanceRecord),
    });
  } catch (err) {
    console.error("Self attendance load error:", err);
    handleControllerError(res, err, "Failed to load self attendance");
  }
};

exports.selfCheckIn = async (req, res) => {
  try {
    if (req.user?.principalType !== "employee") {
      return res.status(403).json({ message: "Only employees can self check in" });
    }

    const settings = await getAttendanceSettings();
    if (!settings.allowSelfCheckIn) {
      return res.status(403).json({ message: "Self check-in is disabled in attendance settings" });
    }

    const employee = await findAccessibleEmployee(req.access || {}, req.user.id);
    const todayKey = getDateKey(new Date());
    const existingRecord = await AttendanceRecord.findOne({
      employeeId: req.user.id,
      attendanceDateKey: todayKey,
    });

    if (existingRecord?.checkInTime) {
      return res.status(400).json({ message: "You have already checked in today" });
    }

    const payload = await prepareAttendanceRecordPayload({
      employee,
      existingRecord,
      input: {
        attendanceDate: todayKey,
        checkInTime: new Date(),
        checkOutTime: existingRecord?.checkOutTime || null,
        remarks: req.body.remarks,
        entryMethod: "self",
      },
      settings,
      actor: buildActor(req.user),
      entryMethod: "self",
    });
    const savedRecord = await saveAttendanceDocument(existingRecord, payload);

    res.json({
      success: true,
      message: "Check-in recorded successfully",
      record: mapAttendanceRecord(savedRecord),
    });
  } catch (err) {
    console.error("Self check-in error:", err);
    handleControllerError(res, err, "Failed to record check-in");
  }
};

exports.selfCheckOut = async (req, res) => {
  try {
    if (req.user?.principalType !== "employee") {
      return res.status(403).json({ message: "Only employees can self check out" });
    }

    const settings = await getAttendanceSettings();
    if (!settings.allowSelfCheckOut) {
      return res.status(403).json({ message: "Self check-out is disabled in attendance settings" });
    }

    const employee = await findAccessibleEmployee(req.access || {}, req.user.id);
    const todayKey = getDateKey(new Date());
    const existingRecord = await AttendanceRecord.findOne({
      employeeId: req.user.id,
      attendanceDateKey: todayKey,
    });

    if (!existingRecord?.checkInTime) {
      return res.status(400).json({ message: "Please check in before checking out" });
    }

    if (existingRecord.checkOutTime) {
      return res.status(400).json({ message: "You have already checked out today" });
    }

    const payload = await prepareAttendanceRecordPayload({
      employee,
      existingRecord,
      input: {
        attendanceDate: todayKey,
        checkInTime: existingRecord.checkInTime,
        checkOutTime: new Date(),
        remarks: req.body.remarks || existingRecord.remarks,
        entryMethod: "self",
      },
      settings,
      actor: buildActor(req.user),
      entryMethod: "self",
    });
    const savedRecord = await saveAttendanceDocument(existingRecord, payload);

    res.json({
      success: true,
      message: "Check-out recorded successfully",
      record: mapAttendanceRecord(savedRecord),
    });
  } catch (err) {
    console.error("Self check-out error:", err);
    handleControllerError(res, err, "Failed to record check-out");
  }
};

exports.getAttendanceSettings = async (_req, res) => {
  try {
    const settings = await getAttendanceSettings();
    res.json(settings);
  } catch (err) {
    console.error("Attendance settings load error:", err);
    handleControllerError(res, err, "Failed to load attendance settings");
  }
};

exports.updateAttendanceSettings = async (req, res) => {
  try {
    validateTimeValue(req.body.officeStartTime, "Office start time");
    validateTimeValue(req.body.officeEndTime, "Office end time");

    const settings = await AttendanceSetting.findOneAndUpdate(
      { scopeKey: "global" },
      {
        $set: {
          officeStartTime: normalizeText(req.body.officeStartTime) || "09:00",
          officeEndTime: normalizeText(req.body.officeEndTime) || "18:00",
          graceMinutes: Math.max(0, Number(req.body.graceMinutes || 0)),
          minimumFullDayHours: Math.max(0, Number(req.body.minimumFullDayHours || 0)),
          minimumHalfDayHours: Math.max(0, Number(req.body.minimumHalfDayHours || 0)),
          missingCheckInStatus:
            normalizeStatusKey(req.body.missingCheckInStatus) === "pending"
              ? "pending"
              : "absent",
          allowSelfCheckIn: Boolean(req.body.allowSelfCheckIn),
          allowSelfCheckOut: Boolean(req.body.allowSelfCheckOut),
          allowRegularization: Boolean(req.body.allowRegularization),
          futureBiometricEnabled: Boolean(req.body.futureBiometricEnabled),
          futureQrEnabled: Boolean(req.body.futureQrEnabled),
          futureGpsEnabled: Boolean(req.body.futureGpsEnabled),
          lateAlertEnabled: Boolean(req.body.lateAlertEnabled),
          missingCheckoutAlertEnabled: Boolean(req.body.missingCheckoutAlertEnabled),
          absenceAlertEnabled: Boolean(req.body.absenceAlertEnabled),
          reminderAlertEnabled: Boolean(req.body.reminderAlertEnabled),
          updatedBy: normalizeText(req.user?.name || req.user?.email),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: "Attendance settings updated successfully",
      settings,
    });
  } catch (err) {
    console.error("Attendance settings update error:", err);
    handleControllerError(res, err, "Failed to update attendance settings");
  }
};

exports.getMonthlyAttendanceReport = async (req, res) => {
  try {
    const result = await buildMonthlyReportRows(req.access || {}, req.query || {});
    res.json(result);
  } catch (err) {
    console.error("Monthly attendance report error:", err);
    handleControllerError(res, err, "Failed to load monthly attendance report");
  }
};

exports.exportMonthlyAttendanceReportExcel = async (req, res) => {
  try {
    const result = await buildMonthlyReportRows(req.access || {}, req.query || {});
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance Report");

    worksheet.columns = [
      { header: "Employee Code", key: "employeeCode", width: 18 },
      { header: "Employee Name", key: "employeeName", width: 28 },
      { header: "Company", key: "companyName", width: 24 },
      { header: "Site", key: "siteName", width: 24 },
      { header: "Department", key: "departmentName", width: 24 },
      { header: "Reporting Head", key: "reportingHeadName", width: 24 },
      { header: "Working Days", key: "workingDays", width: 14 },
      { header: "Present Days", key: "totalPresentDays", width: 14 },
      { header: "Absent Days", key: "totalAbsentDays", width: 14 },
      { header: "Leave Days", key: "totalLeaveDays", width: 14 },
      { header: "Half Days", key: "totalHalfDays", width: 14 },
      { header: "Late Days", key: "totalLateDays", width: 14 },
      { header: "Week Off Days", key: "totalWeekOffDays", width: 16 },
      { header: "Holiday Days", key: "totalHolidayDays", width: 16 },
      { header: "On Duty Days", key: "totalOnDutyDays", width: 16 },
      { header: "Pending Days", key: "totalPendingDays", width: 14 },
    ];

    result.rows.forEach((row) => worksheet.addRow(row));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=attendance-report-${result.month}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Monthly attendance export error:", err);
    handleControllerError(res, err, "Failed to export attendance report");
  }
};

exports.getRegularizationRequests = async (req, res) => {
  try {
    const filter = {};
    const dateRange = getDateRangeFromQuery(req.query || {}, { defaultToToday: false });
    const status = normalizeStatusKey(req.query.status);

    if (req.user?.principalType === "employee") {
      filter.employeeId = req.user.id;
    } else {
      const employeeFilter = await buildAttendanceEmployeeFilter(req.access || {}, req.query || {}, {
        includeInactive: false,
      });

      if (employeeFilter._id === null) {
        return res.json([]);
      }

      const employees = await getAttendanceEmployees(req.access || {}, req.query || {}, {
        includeInactive: false,
      });
      const employeeIds = employees.map((employee) => employee._id);

      if (!employeeIds.length) {
        return res.json([]);
      }

      filter.employeeId = { $in: employeeIds };
    }

    if (dateRange.fromDate || dateRange.toDate) {
      filter.attendanceDate = {};
      if (dateRange.fromDate) filter.attendanceDate.$gte = dateRange.fromDate;
      if (dateRange.toDate) filter.attendanceDate.$lte = dateRange.toDate;
    }

    if (status) {
      filter.status = status;
    }

    const rows = await AttendanceRegularizationRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      rows.map((row) => ({
        ...row,
        attendanceDateLabel: formatDateLabel(row.attendanceDate),
        employeeDisplayName:
          row.employeeCode && row.employeeName
            ? `${row.employeeCode} - ${row.employeeName}`
            : row.employeeName || row.employeeCode || "",
        requestedStatusLabel: getStatusLabel(row.requestedStatus),
        statusLabel: getRegularizationStatusLabel(row.status),
      }))
    );
  } catch (err) {
    console.error("Regularization request load error:", err);
    handleControllerError(res, err, "Failed to load regularization requests");
  }
};

exports.createRegularizationRequest = async (req, res) => {
  try {
    const settings = await getAttendanceSettings();
    if (!settings.allowRegularization) {
      return res.status(403).json({ message: "Attendance regularization is disabled" });
    }

    const employeeId =
      req.user?.principalType === "employee"
        ? normalizeId(req.user.id)
        : normalizeText(req.body.employeeId);
    const attendanceDate = startOfDay(req.body.attendanceDate);
    const reason = normalizeText(req.body.reason);

    if (!employeeId) {
      return res.status(400).json({ message: "Employee is required" });
    }

    if (!attendanceDate) {
      return res.status(400).json({ message: "Attendance date is required" });
    }

    if (!reason) {
      return res.status(400).json({ message: "Regularization reason is required" });
    }

    const employee = await findAccessibleEmployee(req.access || {}, employeeId);
    const attendanceDateKey = getDateKey(attendanceDate);
    const currentRecord = await AttendanceRecord.findOne({
      employeeId,
      attendanceDateKey,
    }).lean();
    const requestRow = await AttendanceRegularizationRequest.create({
      employeeId,
      employeeCode: normalizeText(employee?.employeeCode),
      employeeName: normalizeText(employee?.employeeName),
      attendanceDate,
      attendanceDateKey,
      currentRecordId: currentRecord?._id || null,
      currentStatus: normalizeStatusKey(currentRecord?.status),
      requestedCheckInTime:
        req.body.requestedCheckInTime === ""
          ? null
          : buildDateTime(attendanceDate, req.body.requestedCheckInTime) ||
            toLocalDate(req.body.requestedCheckInTime) ||
            null,
      requestedCheckOutTime:
        req.body.requestedCheckOutTime === ""
          ? null
          : buildDateTime(attendanceDate, req.body.requestedCheckOutTime) ||
            toLocalDate(req.body.requestedCheckOutTime) ||
            null,
      requestedStatus: normalizeStatusKey(req.body.requestedStatus) || "pending",
      reason,
      requestRemarks: normalizeText(req.body.requestRemarks),
      requestedBy: buildActor(req.user),
    });

    res.json({
      success: true,
      message: "Regularization request submitted successfully",
      request: {
        ...requestRow.toObject(),
        attendanceDateLabel: formatDateLabel(requestRow.attendanceDate),
        requestedStatusLabel: getStatusLabel(requestRow.requestedStatus),
        statusLabel: getRegularizationStatusLabel(requestRow.status),
      },
    });
  } catch (err) {
    console.error("Create regularization request error:", err);
    handleControllerError(res, err, "Failed to create regularization request");
  }
};

const decideRegularizationRequest = async (req, res, nextStatus) => {
  try {
    const requestRow = await AttendanceRegularizationRequest.findById(req.params.id);

    if (!requestRow) {
      return res.status(404).json({ message: "Regularization request not found" });
    }

    if (requestRow.status !== "pending") {
      return res.status(400).json({ message: "This regularization request is already closed" });
    }

    const employee = await findAccessibleEmployee(req.access || {}, requestRow.employeeId);
    const actor = buildActor(req.user);

    if (nextStatus === "approved") {
      const settings = await getAttendanceSettings();
      const existingRecord = await AttendanceRecord.findOne({
        employeeId: requestRow.employeeId,
        attendanceDateKey: requestRow.attendanceDateKey,
      });
      const payload = await prepareAttendanceRecordPayload({
        employee,
        existingRecord,
        input: {
          attendanceDate: requestRow.attendanceDateKey,
          checkInTime: requestRow.requestedCheckInTime,
          checkOutTime: requestRow.requestedCheckOutTime,
          status: requestRow.requestedStatus,
          remarks: requestRow.requestRemarks,
          entryMethod: "regularization",
        },
        settings,
        actor,
        entryMethod: "regularization",
      });
      const savedRecord = await saveAttendanceDocument(existingRecord, payload);
      requestRow.currentRecordId = savedRecord._id;
      requestRow.currentStatus = payload.status;
    }

    requestRow.status = nextStatus;
    requestRow.decisionRemarks = normalizeText(req.body.decisionRemarks);
    requestRow.decidedAt = new Date();
    requestRow.decidedBy = actor;
    await requestRow.save();

    res.json({
      success: true,
      message:
        nextStatus === "approved"
          ? "Regularization request approved"
          : "Regularization request rejected",
      request: {
        ...requestRow.toObject(),
        attendanceDateLabel: formatDateLabel(requestRow.attendanceDate),
        requestedStatusLabel: getStatusLabel(requestRow.requestedStatus),
        statusLabel: getRegularizationStatusLabel(requestRow.status),
      },
    });
  } catch (err) {
    console.error("Regularization decision error:", err);
    handleControllerError(res, err, "Failed to update regularization request");
  }
};

exports.approveRegularizationRequest = async (req, res) => {
  await decideRegularizationRequest(req, res, "approved");
};

exports.rejectRegularizationRequest = async (req, res) => {
  await decideRegularizationRequest(req, res, "rejected");
};
