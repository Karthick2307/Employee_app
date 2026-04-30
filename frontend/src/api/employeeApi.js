import api from "./axios";

const EMPLOYEE_BASE_PATH = "/employees";

const buildEmployeePath = (path = "") => {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath || normalizedPath === "/") {
    return EMPLOYEE_BASE_PATH;
  }

  return `${EMPLOYEE_BASE_PATH}${
    normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`
  }`;
};

const employeeApi = {
  defaults: api.defaults,
  get(path = "", config) {
    return api.get(buildEmployeePath(path), config);
  },
  post(path = "", data, config) {
    return api.post(buildEmployeePath(path), data, config);
  },
  put(path = "", data, config) {
    return api.put(buildEmployeePath(path), data, config);
  },
  patch(path = "", data, config) {
    return api.patch(buildEmployeePath(path), data, config);
  },
  delete(path = "", config) {
    return api.delete(buildEmployeePath(path), config);
  },
};

export const addEmployee = (payload) => employeeApi.post("/", payload);

export const updateEmployee = (id, payload) => employeeApi.put(`/${id}`, payload);

export const deleteEmployee = (id) => employeeApi.delete(`/${id}`);

export const activateEmployee = (id) =>
  employeeApi.patch(`/${id}/status`, { isActive: true });

export default employeeApi;
