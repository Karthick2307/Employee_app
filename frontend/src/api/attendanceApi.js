import api from "./axios";

export const getAttendanceOptions = () => api.get("/attendance/options");
export const getAttendanceDashboard = (params) => api.get("/attendance/dashboard", { params });
export const getAttendanceRecords = (params) => api.get("/attendance/records", { params });
export const createAttendanceRecord = (payload) => api.post("/attendance/records", payload);
export const updateAttendanceRecord = (recordId, payload) =>
  api.put(`/attendance/records/${recordId}`, payload);
export const getSelfAttendance = () => api.get("/attendance/self");
export const submitSelfAttendanceAction = (actionKey, payload) =>
  api.post(`/attendance/self/${actionKey}`, payload);
export const getAttendanceRegularizationRequests = (params) =>
  api.get("/attendance/regularization", { params });
export const createAttendanceRegularizationRequest = (payload) =>
  api.post("/attendance/regularization", payload);
export const submitAttendanceRegularizationDecision = (requestId, actionKey, payload) =>
  api.patch(`/attendance/regularization/${requestId}/${actionKey}`, payload);
export const getMonthlyAttendanceReport = (params) =>
  api.get("/attendance/reports/monthly", { params });
export const exportMonthlyAttendanceReport = (params) =>
  api.get("/attendance/reports/monthly/export/excel", {
    params,
    responseType: "blob",
  });
