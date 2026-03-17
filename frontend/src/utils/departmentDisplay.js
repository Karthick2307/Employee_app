const normalizeDepartmentRows = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];

export const formatDepartmentLabel = (department) => {
  if (!department) return "";
  return String(department.name || department || "").trim();
};

export const formatDepartmentList = (departments = []) =>
  normalizeDepartmentRows(departments)
    .map((department) => formatDepartmentLabel(department))
    .filter(Boolean)
    .join(", ");
