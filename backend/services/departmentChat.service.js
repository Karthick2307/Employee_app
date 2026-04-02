const Department = require("../models/Department");
const createChatModuleService = require("./createChatModule.service");

const formatDepartmentDisplayName = (department) =>
  String(department?.name || "").trim() || "Department";

const formatDepartmentGroupName = (department) => {
  const departmentName = String(department?.name || "").trim() || "Department";
  return `${departmentName} Department Chat`;
};

module.exports = createChatModuleService({
  chatType: "department",
  emptyScopeLabel: "Department",
  emptyChatLabel: "Department Chat",
  employeeScopeField: "department",
  viewerEmployeeProjection: "employeeCode employeeName email department",
  getAllActiveScopes: () =>
    Department.find({ isActive: { $ne: false } })
      .sort({ name: 1 })
      .lean(),
  getScopeOwnerNames: (department) => [
    ...(department?.headNames || []),
    ...(department?.departmentLeadNames || []),
  ],
  getScopeSearchTerms: (department) => [
    department?.name,
    formatDepartmentDisplayName(department),
  ],
  formatScopeDisplayName: formatDepartmentDisplayName,
  formatGroupName: formatDepartmentGroupName,
  buildScopeSummary: (department) => ({
    departmentId: String(department?._id || "").trim(),
    departmentName: String(department?.name || "").trim(),
    departmentDisplayName: formatDepartmentDisplayName(department),
  }),
});
