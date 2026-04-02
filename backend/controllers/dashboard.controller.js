const { Types } = require("mongoose");
const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const PersonalTask = require("../models/PersonalTask");
const Site = require("../models/Site");
const User = require("../models/User");

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
const normalizeIdentityValue = (value) => normalizeText(value).toLowerCase();
const normalizeTextList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const normalizedKey = item.toLowerCase();
      if (seen.has(normalizedKey)) return false;
      seen.add(normalizedKey);
      return true;
    });
};

const normalizeIdList = (value) => {
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

const buildIdentitySet = (values = []) =>
  new Set(
    values.map((value) => normalizeIdentityValue(value)).filter(Boolean)
  );

const matchesIdentitySet = (values = [], identitySet = new Set()) =>
  (Array.isArray(values) ? values : [values]).some((value) =>
    identitySet.has(normalizeIdentityValue(value))
  );

const getRequesterRole = (user) => normalizeText(user?.role).toLowerCase();

const isAdminRequester = (user) => getRequesterRole(user) === "admin";

const isEmployeeRequester = (user) => getRequesterRole(user) === "employee";

const hasDashboardAccess = (user) =>
  isAdminRequester(user) ||
  isEmployeeRequester(user) ||
  getRequesterRole(user) === "user" ||
  Boolean(user?.checklistMasterAccess);

const isValidObjectId = (value) => Types.ObjectId.isValid(normalizeId(value));

const getRestrictedDashboardSiteId = (user) => {
  if (isAdminRequester(user) || isEmployeeRequester(user)) return "";
  if (!(getRequesterRole(user) === "user" || Boolean(user?.checklistMasterAccess))) return "";

  const siteId = normalizeId(user?.siteId);
  return isValidObjectId(siteId) ? siteId : "";
};

const roundMarkValue = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;

  return Math.round(parsedValue * 100) / 100;
};

const summarizeEmployeeMarks = (employees = []) => {
  let totalMark = 0;
  let hasScoredMark = false;
  let scoredChecklistCount = 0;

  for (const employee of employees) {
    const overallMark = Number(employee?.overallMark);
    if (Number.isFinite(overallMark)) {
      totalMark += overallMark;
      hasScoredMark = true;
    }

    scoredChecklistCount += Number(employee?.scoredChecklistCount || 0);
  }

  return {
    overallMark: hasScoredMark ? roundMarkValue(totalMark) : null,
    scoredChecklistCount,
  };
};

const sortByLabel = (left, right) =>
  String(
    left?.label || left?.name || left?.employeeName || left?.employeeCode || ""
  ).localeCompare(
    String(
      right?.label || right?.name || right?.employeeName || right?.employeeCode || ""
    ),
    "en",
    { sensitivity: "base" }
  );

const findSubDepartmentTrail = (rows = [], subDepartmentId, trail = []) => {
  for (const row of rows) {
    const nextTrail = [...trail, row.name];

    if (normalizeId(row?._id) === normalizeId(subDepartmentId)) {
      return nextTrail;
    }

    const childTrail = findSubDepartmentTrail(row.children || [], subDepartmentId, nextTrail);
    if (childTrail) return childTrail;
  }

  return null;
};

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((row) => {
    const nextTrail = [...trail, row.name];

    return [
      {
        _id: normalizeId(row?._id),
        name: row.name || "",
        departmentId: normalizeId(department?._id),
        departmentName: department?.name || "",
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(row.children || [], nextTrail, department),
    ];
  });

const getEmployeeSubDepartmentDetails = (departmentRows = [], subDepartmentRefs = []) =>
  normalizeIdList(subDepartmentRefs)
    .map((subDepartmentId) => {
      for (const department of departmentRows) {
        const trail = findSubDepartmentTrail(department?.subDepartments || [], subDepartmentId);
        if (!trail?.length) continue;

        return {
          _id: subDepartmentId,
          departmentId: normalizeId(department?._id),
          departmentName: department?.name || "",
          name: trail[trail.length - 1] || "",
          path: department?.name
            ? `${department.name} > ${trail.join(" > ")}`
            : trail.join(" > "),
        };
      }

      return null;
    })
    .filter(Boolean);

const buildEmployeeDashboardRow = (employeeDoc, employeeMarkMap) => {
  const departmentRows = (Array.isArray(employeeDoc?.department) ? employeeDoc.department : [])
    .filter((row) => row && typeof row === "object");
  const departmentIds = normalizeIdList(
    departmentRows.length ? departmentRows.map((row) => row._id) : employeeDoc?.department
  );
  const departmentDisplay = departmentRows
    .map((row) => String(row?.name || "").trim())
    .filter(Boolean)
    .join(", ");
  const subDepartmentIds = normalizeIdList(employeeDoc?.subDepartment);
  const subDepartmentDetails = getEmployeeSubDepartmentDetails(
    departmentRows,
    subDepartmentIds
  );
  const subDepartmentDisplay = subDepartmentDetails
    .map((row) => String(row?.path || row?.name || "").trim())
    .filter(Boolean)
    .join(", ");
  const employeeId = normalizeId(employeeDoc?._id);
  const markSummary = employeeMarkMap.get(employeeId);
  const siteIds = normalizeIdList(employeeDoc?.sites);

  return {
    _id: employeeId,
    employeeCode: employeeDoc?.employeeCode || "",
    employeeName: employeeDoc?.employeeName || "",
    photo: employeeDoc?.photo || null,
    isActive: employeeDoc?.isActive !== false,
    siteIds,
    departmentIds,
    subDepartmentIds,
    departmentDisplay,
    subDepartmentDisplay,
    overallMark: roundMarkValue(markSummary?.overallMark),
    scoredChecklistCount: Number(markSummary?.scoredChecklistCount || 0),
  };
};

const sanitizeEmployeeDashboardRow = (employee = {}) => {
  const { siteIds, departmentIds, subDepartmentIds, ...safeEmployee } = employee;
  return safeEmployee;
};

const buildDepartmentChoices = (departmentDocs = [], employees = []) => {
  return departmentDocs
    .map((department) => {
      const departmentId = normalizeId(department?._id);
      const departmentEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).includes(departmentId)
      );
      const markSummary = summarizeEmployeeMarks(departmentEmployees);

      return {
        _id: departmentId,
        name: department?.name || "",
        employeeCount: departmentEmployees.length,
        subDepartmentCount: flattenSubDepartments(
          department?.subDepartments || [],
          [],
          department
        ).length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((department) => department.employeeCount > 0)
    .sort(sortByLabel);
};

const buildScopedSubDepartmentChoices = (departmentDocs = [], employees = []) => {
  return departmentDocs
    .flatMap((departmentDoc) => {
      const departmentId = normalizeId(departmentDoc?._id);
      const departmentEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).includes(departmentId)
      );

      return buildSubDepartmentChoices(departmentDoc, departmentEmployees);
    })
    .sort(sortByLabel);
};

const buildSubDepartmentChoices = (departmentDoc, employees = []) => {
  return flattenSubDepartments(departmentDoc?.subDepartments || [], [], departmentDoc)
    .map((subDepartment) => {
      const subDepartmentEmployees = employees.filter((employee) =>
        (employee.subDepartmentIds || []).includes(subDepartment._id)
      );
      const markSummary = summarizeEmployeeMarks(subDepartmentEmployees);

      return {
        ...subDepartment,
        employeeCount: subDepartmentEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((subDepartment) => subDepartment.employeeCount > 0)
    .sort(sortByLabel);
};

const buildCompanyChoices = (companyDocs = [], siteDocs = [], employees = []) => {
  const siteMap = new Map(
    siteDocs.map((site) => [normalizeId(site?._id), normalizeText(site?.companyName)])
  );
  const companyNames = new Set();

  for (const companyDoc of companyDocs) {
    const companyName = normalizeText(companyDoc?.name);
    if (companyName) companyNames.add(companyName);
  }

  for (const siteDoc of siteDocs) {
    const companyName = normalizeText(siteDoc?.companyName);
    if (companyName) companyNames.add(companyName);
  }

  return Array.from(companyNames)
    .map((companyName) => {
      const companyEmployees = employees.filter((employee) =>
        (employee.siteIds || []).some(
          (siteId) => normalizeText(siteMap.get(siteId)) === companyName
        )
      );
      const markSummary = summarizeEmployeeMarks(companyEmployees);
      const departmentIdSet = new Set(
        companyEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
      );
      const subDepartmentIdSet = new Set(
        companyEmployees.flatMap((employee) => employee.subDepartmentIds || []).filter(Boolean)
      );

      return {
        _id: companyName,
        name: companyName,
        siteCount: siteDocs.filter(
          (siteDoc) => normalizeText(siteDoc?.companyName) === companyName
        ).length,
        departmentCount: departmentIdSet.size,
        subDepartmentCount: subDepartmentIdSet.size,
        employeeCount: companyEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .sort(sortByLabel);
};

const buildSiteChoices = (siteDocs = [], employees = [], companyName = "") => {
  return siteDocs
    .filter((siteDoc) =>
      !companyName || normalizeText(siteDoc?.companyName) === normalizeText(companyName)
    )
    .map((siteDoc) => {
      const siteId = normalizeId(siteDoc?._id);
      const siteEmployees = employees.filter((employee) => (employee.siteIds || []).includes(siteId));
      const markSummary = summarizeEmployeeMarks(siteEmployees);
      const departmentIdSet = new Set(
        siteEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
      );
      const subDepartmentIdSet = new Set(
        siteEmployees.flatMap((employee) => employee.subDepartmentIds || []).filter(Boolean)
      );

      return {
        _id: siteId,
        name: siteDoc?.name || "",
        companyName: normalizeText(siteDoc?.companyName),
        departmentCount: departmentIdSet.size,
        subDepartmentCount: subDepartmentIdSet.size,
        employeeCount: siteEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .sort(sortByLabel);
};

const buildSiteLeadChoices = (siteDocs = [], employees = []) =>
  Array.from(
    new Set(
      siteDocs.flatMap((siteDoc) => normalizeTextList(siteDoc?.siteLeadNames || []))
    )
  )
    .map((leadName) => {
      const leadSites = siteDocs.filter((siteDoc) =>
        normalizeTextList(siteDoc?.siteLeadNames || []).includes(leadName)
      );
      const leadSiteIds = new Set(
        leadSites.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
      );
      const leadEmployees = employees.filter((employee) =>
        (employee.siteIds || []).some((siteId) => leadSiteIds.has(siteId))
      );
      const markSummary = summarizeEmployeeMarks(leadEmployees);

      return {
        _id: leadName,
        name: leadName,
        siteCount: leadSites.length,
        employeeCount: leadEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((lead) => lead.siteCount > 0)
    .sort(sortByLabel);

const buildDepartmentLeadChoices = (departmentDocs = [], employees = []) =>
  Array.from(
    new Set(
      departmentDocs.flatMap((departmentDoc) =>
        normalizeTextList(departmentDoc?.departmentLeadNames || [])
      )
    )
  )
    .map((leadName) => {
      const leadDepartments = departmentDocs.filter((departmentDoc) =>
        normalizeTextList(departmentDoc?.departmentLeadNames || []).includes(leadName)
      );
      const leadDepartmentIds = new Set(
        leadDepartments.map((departmentDoc) => normalizeId(departmentDoc?._id)).filter(Boolean)
      );
      const leadEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).some((departmentId) => leadDepartmentIds.has(departmentId))
      );
      const markSummary = summarizeEmployeeMarks(leadEmployees);

      return {
        _id: leadName,
        name: leadName,
        departmentCount: leadDepartments.length,
        employeeCount: leadEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((lead) => lead.departmentCount > 0)
    .sort(sortByLabel);

const buildCompletedTaskRows = async (employeeId) => {
  const normalizedEmployeeId = normalizeId(employeeId);
  if (!normalizedEmployeeId) return [];

  return ChecklistTask.find(
    {
      assignedEmployee: normalizedEmployeeId,
      finalMark: { $ne: null },
    },
    "taskNumber checklistName occurrenceDate completedAt status timelinessStatus finalMark"
  )
    .sort({ completedAt: -1, occurrenceDate: -1 })
    .lean();
};

const getLatestDateValue = (values = []) =>
  values
    .map((value) => (value ? new Date(value) : null))
    .filter((value) => value && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;

const filterDashboardSnapshotForViewer = async ({
  user,
  companyDocs = [],
  departmentDocs = [],
  siteDocs = [],
  employees = [],
}) => {
  if (!user || isAdminRequester(user)) {
    return { companyDocs, departmentDocs, siteDocs, employees };
  }

  if (!hasDashboardAccess(user)) {
    return {
      companyDocs: [],
      departmentDocs: [],
      siteDocs: [],
      employees: [],
    };
  }

  const siteDocById = new Map(siteDocs.map((siteDoc) => [normalizeId(siteDoc?._id), siteDoc]));
  const restrictedSiteId = getRestrictedDashboardSiteId(user);

  if (restrictedSiteId) {
    const scopedSiteDocs = siteDocs.filter(
      (siteDoc) => normalizeId(siteDoc?._id) === restrictedSiteId
    );
    const scopedSiteIdSet = new Set(
      scopedSiteDocs.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
    );
    const scopedEmployees = employees.filter((employee) =>
      (employee.siteIds || []).some((siteId) => scopedSiteIdSet.has(siteId))
    );
    const scopedDepartmentIdSet = new Set(
      scopedEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
    );
    const scopedCompanyNameSet = new Set(
      scopedSiteDocs.map((siteDoc) => normalizeText(siteDoc?.companyName)).filter(Boolean)
    );

    return {
      companyDocs: companyDocs.filter((companyDoc) =>
        scopedCompanyNameSet.has(normalizeText(companyDoc?.name))
      ),
      departmentDocs: departmentDocs.filter((departmentDoc) =>
        scopedDepartmentIdSet.has(normalizeId(departmentDoc?._id))
      ),
      siteDocs: scopedSiteDocs,
      employees: scopedEmployees,
    };
  }

  if (!isEmployeeRequester(user)) {
    return { companyDocs, departmentDocs, siteDocs, employees };
  }

  const viewer = await Employee.findById(
    user?.id,
    "employeeCode employeeName email sites department isActive"
  ).lean();

  if (!viewer || viewer.isActive === false) {
    return {
      companyDocs: [],
      departmentDocs: [],
      siteDocs: [],
      employees: [],
    };
  }

  const viewerIdentitySet = buildIdentitySet([
    viewer.employeeName,
    viewer.employeeCode,
    viewer.email,
    user?.email,
  ]);
  const allowedCompanyNameSet = new Set(
    companyDocs
      .filter((companyDoc) => matchesIdentitySet(companyDoc?.directorNames, viewerIdentitySet))
      .map((companyDoc) => normalizeText(companyDoc?.name))
      .filter(Boolean)
  );
  const allowedSiteIdSet = new Set([
    ...normalizeIdList(viewer?.sites),
    ...siteDocs
      .filter(
        (siteDoc) =>
          matchesIdentitySet(siteDoc?.headNames, viewerIdentitySet) ||
          matchesIdentitySet(siteDoc?.siteLeadNames, viewerIdentitySet)
      )
      .map((siteDoc) => normalizeId(siteDoc?._id))
      .filter(Boolean),
  ]);
  const allowedDepartmentIdSet = new Set([
    ...normalizeIdList(viewer?.department),
    ...departmentDocs
      .filter(
        (departmentDoc) =>
          matchesIdentitySet(departmentDoc?.headNames, viewerIdentitySet) ||
          matchesIdentitySet(departmentDoc?.departmentLeadNames, viewerIdentitySet)
      )
      .map((departmentDoc) => normalizeId(departmentDoc?._id))
      .filter(Boolean),
  ]);
  const scopedEmployees = employees.filter((employee) => {
    const siteMatch = (employee.siteIds || []).some((siteId) => allowedSiteIdSet.has(siteId));
    const departmentMatch = (employee.departmentIds || []).some((departmentId) =>
      allowedDepartmentIdSet.has(departmentId)
    );

    return siteMatch || departmentMatch || normalizeId(employee?._id) === normalizeId(viewer?._id);
  });
  const scopedSiteIdSet = new Set(allowedSiteIdSet);
  const scopedDepartmentIdSet = new Set(allowedDepartmentIdSet);
  const scopedCompanyNameSet = new Set(allowedCompanyNameSet);

  scopedEmployees.forEach((employee) => {
    (employee.siteIds || []).forEach((siteId) => {
      if (!siteId) return;
      scopedSiteIdSet.add(siteId);

      const siteDoc = siteDocById.get(siteId);
      const companyName = normalizeText(siteDoc?.companyName);
      if (companyName) {
        scopedCompanyNameSet.add(companyName);
      }
    });

    (employee.departmentIds || []).forEach((departmentId) => {
      if (departmentId) {
        scopedDepartmentIdSet.add(departmentId);
      }
    });
  });

  const scopedSiteDocs = siteDocs.filter((siteDoc) => {
    const siteId = normalizeId(siteDoc?._id);
    const companyName = normalizeText(siteDoc?.companyName);

    return scopedSiteIdSet.has(siteId) || scopedCompanyNameSet.has(companyName);
  });

  scopedSiteDocs.forEach((siteDoc) => {
    const companyName = normalizeText(siteDoc?.companyName);
    if (companyName) {
      scopedCompanyNameSet.add(companyName);
    }
  });

  return {
    companyDocs: companyDocs.filter((companyDoc) =>
      scopedCompanyNameSet.has(normalizeText(companyDoc?.name))
    ),
    departmentDocs: departmentDocs.filter((departmentDoc) =>
      scopedDepartmentIdSet.has(normalizeId(departmentDoc?._id))
    ),
    siteDocs: scopedSiteDocs,
    employees: scopedEmployees,
  };
};

const buildDashboardSnapshot = async (user = null) => {
  const [companyDocs, departmentDocs, siteDocs, employeeDocs, employeeMarkRows] = await Promise.all([
    Company.find({}, "name directorNames").sort({ name: 1 }).lean(),
    Department.find({}, "name subDepartments headNames departmentLeadNames").sort({ name: 1 }).lean(),
    Site.find({}, "companyName name headNames siteLeadNames").sort({ name: 1 }).lean(),
    Employee.find(
      {},
      "employeeCode employeeName email photo isActive department subDepartment sites"
    )
      .populate("department", "name subDepartments")
      .lean(),
    ChecklistTask.aggregate([
      {
        $match: {
          assignedEmployee: { $ne: null },
          finalMark: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$assignedEmployee",
          overallMark: { $sum: "$finalMark" },
          scoredChecklistCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  const employeeMarkMap = new Map(
    employeeMarkRows.map((row) => [
      normalizeId(row?._id),
      {
        overallMark: row?.overallMark,
        scoredChecklistCount: row?.scoredChecklistCount,
      },
    ])
  );

  const employees = employeeDocs
    .map((employee) => buildEmployeeDashboardRow(employee, employeeMarkMap))
    .sort(sortByLabel);
  const scopedSnapshot = await filterDashboardSnapshotForViewer({
    user,
    companyDocs,
    departmentDocs,
    siteDocs,
    employees,
  });
  const departments = buildDepartmentChoices(
    scopedSnapshot.departmentDocs,
    scopedSnapshot.employees
  );
  const subDepartments = buildScopedSubDepartmentChoices(
    scopedSnapshot.departmentDocs,
    scopedSnapshot.employees
  );
  const companies = buildCompanyChoices(
    scopedSnapshot.companyDocs,
    scopedSnapshot.siteDocs,
    scopedSnapshot.employees
  );
  const sites = buildSiteChoices(scopedSnapshot.siteDocs, scopedSnapshot.employees);

  return {
    companies,
    departmentDocs: scopedSnapshot.departmentDocs,
    departments,
    employees: scopedSnapshot.employees,
    sites,
    siteDocs: scopedSnapshot.siteDocs,
    subDepartments,
  };
};

exports.getWelcomeSummary = async (req, res) => {
  try {
    const requesterRole = normalizeText(req.user?.role).toLowerCase();

    if (requesterRole !== "employee") {
      const account = await User.findById(req.user?.id, "name email role").lean();

      return res.json({
        userName:
          normalizeText(account?.name) ||
          normalizeText(account?.email) ||
          normalizeText(req.user?.email) ||
          "User",
        pendingTaskCount: 0,
        pendingChecklistCount: 0,
        pendingReminderCount: 0,
        isDepartmentSuperior: false,
        departmentPendingCount: 0,
      });
    }

    const employee = await Employee.findById(
      req.user?.id,
      "employeeName employeeCode email isActive"
    ).lean();

    if (!employee || employee.isActive === false) {
      return res.status(404).json({ message: "Employee account not found" });
    }

    const employeeIdentitySet = buildIdentitySet([
      employee.employeeName,
      employee.employeeCode,
      employee.email,
    ]);

    const [
      pendingChecklistCount,
      pendingReminderCount,
      departmentRows,
      directReportRows,
    ] = await Promise.all([
      ChecklistTask.countDocuments({
        assignedEmployee: employee._id,
        status: { $in: ["open", "rejected"] },
      }),
      PersonalTask.countDocuments({
        assignedEmployee: employee._id,
        status: "pending",
      }),
      Department.find(
        { isActive: { $ne: false } },
        "_id name headNames departmentLeadNames"
      ).lean(),
      Employee.find(
        { superiorEmployee: employee._id, isActive: true },
        "_id"
      ).lean(),
    ]);

    const managedDepartmentRows = departmentRows.filter(
      (department) =>
        matchesIdentitySet(department?.headNames, employeeIdentitySet) ||
        matchesIdentitySet(department?.departmentLeadNames, employeeIdentitySet)
    );
    const managedDepartmentIds = managedDepartmentRows
      .map((department) => normalizeId(department?._id))
      .filter(Boolean);

    const managedDepartmentEmployeeRows = managedDepartmentIds.length
      ? await Employee.find(
          {
            department: { $in: managedDepartmentIds },
            isActive: true,
          },
          "_id"
        ).lean()
      : [];

    const managedEmployeeIds = [
      ...new Set(
        [...directReportRows, ...managedDepartmentEmployeeRows]
          .map((employeeRow) => normalizeId(employeeRow?._id))
          .filter(Boolean)
      ),
    ];

    const departmentPendingCount = managedEmployeeIds.length
      ? await ChecklistTask.countDocuments({
          assignedEmployee: { $in: managedEmployeeIds },
          status: { $in: ["open", "rejected"] },
        })
      : 0;

    return res.json({
      userName:
        normalizeText(employee.employeeName) ||
        normalizeText(employee.employeeCode) ||
        normalizeText(req.user?.email) ||
        "Employee",
      pendingTaskCount: Number(pendingChecklistCount || 0) + Number(pendingReminderCount || 0),
      pendingChecklistCount: Number(pendingChecklistCount || 0),
      pendingReminderCount: Number(pendingReminderCount || 0),
      isDepartmentSuperior: managedEmployeeIds.length > 0,
      departmentPendingCount: Number(departmentPendingCount || 0),
    });
  } catch (err) {
    console.error("GET WELCOME SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Failed to load welcome summary" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      snapshot,
      totalChecklistTasks,
      latestEmployee,
      latestChecklist,
      latestChecklistTask,
      latestDepartment,
    ] = await Promise.all([
      buildDashboardSnapshot(req.user),
      ChecklistTask.countDocuments(),
      Employee.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      Checklist.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      ChecklistTask.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      Department.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);

    const total = snapshot.employees.length;
    const active = snapshot.employees.filter((employee) => employee.isActive).length;
    const inactive = total - active;
    const lastUpdated = getLatestDateValue([
      latestEmployee?.updatedAt,
      latestChecklist?.updatedAt,
      latestChecklistTask?.updatedAt,
      latestDepartment?.updatedAt,
    ]);

    return res.json({
      total,
      active,
      inactive,
      totalChecklistTasks,
      lastUpdated,
      byDepartment: snapshot.departments.map((department) => ({
        _id: department._id,
        name: department.name,
        count: department.employeeCount,
      })),
      employeeOverallMarks: snapshot.employees.map(sanitizeEmployeeDashboardRow),
    });
  } catch (err) {
    console.error("GET DASHBOARD STATS ERROR:", err);
    return res.status(500).json({ message: "Failed to load dashboard data" });
  }
};

exports.getEmployeeMarkDrilldown = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user);
    const selectedDepartmentId = normalizeId(req.query?.departmentId);
    const selectedDepartmentDoc = snapshot.departmentDocs.find(
      (department) => normalizeId(department?._id) === selectedDepartmentId
    );
    const selectedDepartment =
      snapshot.departments.find((department) => department._id === selectedDepartmentId) || null;

    let subDepartments = [];
    let selectedSubDepartment = null;
    let employees = [];
    let selectedEmployee = null;
    let completedTasks = [];

    if (selectedDepartmentDoc) {
      const departmentEmployees = snapshot.employees.filter((employee) =>
        employee.departmentIds.includes(selectedDepartmentId)
      );
      subDepartments = buildSubDepartmentChoices(selectedDepartmentDoc, departmentEmployees);

      const selectedSubDepartmentId = normalizeId(req.query?.subDepartmentId);
      selectedSubDepartment =
        subDepartments.find((subDepartment) => subDepartment._id === selectedSubDepartmentId) ||
        null;

      employees = departmentEmployees
        .filter((employee) =>
          !selectedSubDepartment || employee.subDepartmentIds.includes(selectedSubDepartment._id)
        )
        .sort(sortByLabel);

      const selectedEmployeeId = normalizeId(req.query?.employeeId);
      selectedEmployee =
        employees.find((employee) => employee._id === selectedEmployeeId) || null;

      completedTasks = selectedEmployee
        ? await buildCompletedTaskRows(selectedEmployee._id)
        : [];
    }

    return res.json({
      departments: snapshot.departments,
      selectedDepartment,
      subDepartments,
      selectedSubDepartment,
      employees: employees.map(sanitizeEmployeeDashboardRow),
      selectedEmployee: selectedEmployee ? sanitizeEmployeeDashboardRow(selectedEmployee) : null,
      completedTasks,
    });
  } catch (err) {
    console.error("GET EMPLOYEE MARK DRILLDOWN ERROR:", err);
    return res.status(500).json({ message: "Failed to load employee mark drilldown" });
  }
};

exports.getCompanySiteEmployeeMarkDrilldown = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user);
    const selectedCompanyId = normalizeText(req.query?.companyId);
    const useWorkflowHierarchy = normalizeText(req.query?.hierarchySource) === "workflow";
    const selectedCompany =
      snapshot.companies.find((company) => company._id === selectedCompanyId) || null;

    let siteLeads = [];
    let selectedSiteLead = null;
    let sites = [];
    let selectedSite = null;
    let departmentLeads = [];
    let selectedDepartmentLead = null;
    let departments = [];
    let selectedDepartment = null;
    let subDepartments = [];
    let selectedSubDepartment = null;
    let employees = [];
    let selectedEmployee = null;
    let completedTasks = [];

    if (selectedCompany) {
      const companySites = snapshot.siteDocs.filter(
        (siteDoc) => normalizeText(siteDoc?.companyName) === normalizeText(selectedCompany.name)
      );
      const companySiteIds = new Set(
        companySites.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
      );
      const companyEmployees = snapshot.employees.filter((employee) =>
        (employee.siteIds || []).some((siteId) => companySiteIds.has(siteId))
      );

      if (useWorkflowHierarchy) {
        siteLeads = buildSiteLeadChoices(companySites, companyEmployees);

        const selectedSiteLeadId = normalizeText(req.query?.siteLeadId);
        selectedSiteLead =
          siteLeads.find((siteLead) => siteLead._id === selectedSiteLeadId) || null;

        const leadScopedSites = siteLeads.length
          ? selectedSiteLead
            ? companySites.filter((siteDoc) =>
                normalizeTextList(siteDoc?.siteLeadNames || []).includes(selectedSiteLead._id)
              )
            : []
          : companySites;

        sites = buildSiteChoices(leadScopedSites, companyEmployees);
      } else {
        sites = buildSiteChoices(companySites, companyEmployees);
      }

      const selectedSiteId = normalizeId(req.query?.siteId);
      selectedSite = sites.find((site) => site._id === selectedSiteId) || null;

      if (selectedSite) {
        const siteEmployees = companyEmployees.filter((employee) =>
          employee.siteIds.includes(selectedSite._id)
        );

        if (useWorkflowHierarchy) {
          departmentLeads = buildDepartmentLeadChoices(snapshot.departmentDocs, siteEmployees);

          const selectedDepartmentLeadId = normalizeText(req.query?.departmentLeadId);
          selectedDepartmentLead =
            departmentLeads.find(
              (departmentLead) => departmentLead._id === selectedDepartmentLeadId
            ) || null;

          const leadScopedDepartments = departmentLeads.length
            ? selectedDepartmentLead
              ? snapshot.departmentDocs.filter((departmentDoc) =>
                  normalizeTextList(departmentDoc?.departmentLeadNames || []).includes(
                    selectedDepartmentLead._id
                  )
                )
              : []
            : snapshot.departmentDocs;

          departments = buildDepartmentChoices(leadScopedDepartments, siteEmployees);
        } else {
          departments = buildDepartmentChoices(snapshot.departmentDocs, siteEmployees);
        }

        const selectedDepartmentId = normalizeId(req.query?.departmentId);
        const selectedDepartmentDoc = snapshot.departmentDocs.find(
          (department) => normalizeId(department?._id) === selectedDepartmentId
        );
        selectedDepartment =
          departments.find((department) => department._id === selectedDepartmentId) || null;

        if (selectedDepartmentDoc && selectedDepartment) {
          const departmentEmployees = siteEmployees.filter((employee) =>
            employee.departmentIds.includes(selectedDepartmentId)
          );

          subDepartments = buildSubDepartmentChoices(selectedDepartmentDoc, departmentEmployees);

          const selectedSubDepartmentId = normalizeId(req.query?.subDepartmentId);
          selectedSubDepartment =
            subDepartments.find(
              (subDepartment) => subDepartment._id === selectedSubDepartmentId
            ) || null;

          employees = departmentEmployees
            .filter((employee) =>
              !selectedSubDepartment ||
              employee.subDepartmentIds.includes(selectedSubDepartment._id)
            )
            .sort(sortByLabel);

          const selectedEmployeeId = normalizeId(req.query?.employeeId);
          selectedEmployee =
            employees.find((employee) => employee._id === selectedEmployeeId) || null;

          completedTasks = selectedEmployee
            ? await buildCompletedTaskRows(selectedEmployee._id)
            : [];
        }
      }
    }

    return res.json({
      companies: snapshot.companies,
      levelSummaries: {
        companies: snapshot.companies,
        sites: snapshot.sites,
        departments: snapshot.departments,
        subDepartments: snapshot.subDepartments,
        employees: snapshot.employees.map((employee) => ({
          _id: employee._id,
          name: employee.employeeName || employee.employeeCode || "",
          employeeCode: employee.employeeCode || "",
          departmentDisplay: employee.departmentDisplay || "",
          subDepartmentDisplay: employee.subDepartmentDisplay || "",
          employeeCount: 1,
          overallMark: employee.overallMark,
          scoredChecklistCount: employee.scoredChecklistCount,
          isActive: employee.isActive !== false,
        })),
      },
      selectedCompany,
      siteLeads,
      selectedSiteLead,
      sites,
      selectedSite,
      departmentLeads,
      selectedDepartmentLead,
      departments,
      selectedDepartment,
      subDepartments,
      selectedSubDepartment,
      employees: employees.map(sanitizeEmployeeDashboardRow),
      selectedEmployee: selectedEmployee ? sanitizeEmployeeDashboardRow(selectedEmployee) : null,
      completedTasks,
    });
  } catch (err) {
    console.error("GET COMPANY SITE EMPLOYEE MARK DRILLDOWN ERROR:", err);
    return res.status(500).json({ message: "Failed to load company site employee mark drilldown" });
  }
};
