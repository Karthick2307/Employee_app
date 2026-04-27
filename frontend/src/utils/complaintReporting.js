export const defaultComplaintFilters = {
  fromDate: "",
  toDate: "",
  company: "",
  site: "",
  department: "",
  complaintStatus: "",
  level: "",
  employeeName: "",
  search: "",
  sortBy: "raisedAt",
  sortDirection: "desc",
};

export const complaintStatusToneMap = {
  neutral: {
    className: "complaint-stat-card--neutral",
  },
  info: {
    className: "complaint-stat-card--info",
  },
  primary: {
    className: "complaint-stat-card--primary",
  },
  success: {
    className: "complaint-stat-card--success",
  },
  danger: {
    className: "complaint-stat-card--danger",
  },
  warning: {
    className: "complaint-stat-card--warning",
  },
  secondary: {
    className: "complaint-stat-card--secondary",
  },
  dark: {
    className: "complaint-stat-card--dark",
  },
};

export const parseComplaintFiltersFromSearchParams = (searchParams) => {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams);

  return {
    ...defaultComplaintFilters,
    fromDate: params.get("fromDate") || "",
    toDate: params.get("toDate") || "",
    company: params.get("company") || "",
    site: params.get("site") || "",
    department: params.get("department") || "",
    complaintStatus: params.get("complaintStatus") || "",
    level: params.get("level") || "",
    employeeName: params.get("employeeName") || "",
    search: params.get("search") || "",
    sortBy: params.get("sortBy") || defaultComplaintFilters.sortBy,
    sortDirection: params.get("sortDirection") || defaultComplaintFilters.sortDirection,
  };
};

export const buildComplaintQueryParams = (filters = {}) => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    const normalizedValue = String(value ?? "").trim();

    if (!normalizedValue) return;

    if (
      key === "sortBy" &&
      normalizedValue === defaultComplaintFilters.sortBy
    ) {
      return;
    }

    if (
      key === "sortDirection" &&
      normalizedValue === defaultComplaintFilters.sortDirection
    ) {
      return;
    }

    params.set(key, normalizedValue);
  });

  return params;
};

export const buildComplaintRequestParams = (filters = {}) =>
  Object.fromEntries(buildComplaintQueryParams(filters).entries());

export const getComplaintDownloadFileName = (headers = {}, fallbackFileName) => {
  const contentDisposition = headers?.["content-disposition"] || "";
  const utfFileNameMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (utfFileNameMatch?.[1]) {
    return decodeURIComponent(utfFileNameMatch[1]);
  }

  const fileNameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return fileNameMatch?.[1] || fallbackFileName;
};

export const toggleComplaintSort = (currentFilters = {}, field) => {
  const nextDirection =
    currentFilters.sortBy === field && currentFilters.sortDirection === "asc"
      ? "desc"
      : "asc";

  return {
    ...currentFilters,
    sortBy: field,
    sortDirection: nextDirection,
  };
};

export const getComplaintSortIndicator = (currentFilters = {}, field) => {
  if (currentFilters.sortBy !== field) return "";
  return currentFilters.sortDirection === "asc" ? "↑" : "↓";
};

export const buildComplaintDrilldownFilters = (
  currentFilters = {},
  drilldownOverrides = {}
) => ({
  ...defaultComplaintFilters,
  ...currentFilters,
  ...drilldownOverrides,
  search: "",
});
