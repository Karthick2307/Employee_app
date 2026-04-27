import api from "./axios";

export const getComplaintOptions = () => api.get("/complaints/options");
export const createComplaint = (payload, config = {}) => api.post("/complaints", payload, config);
export const getComplaintDashboard = () => api.get("/complaints/dashboard");
export const getComplaintReport = (params) => api.get("/complaints", { params });
export const getComplaintDetail = (complaintId) => api.get(`/complaints/${complaintId}`);
export const updateComplaint = (complaintId, payload) =>
  api.patch(`/complaints/${complaintId}/action`, payload);
export const exportComplaintReport = (format, params) =>
  api.get(`/complaints/export/${format}`, {
    params,
    responseType: "blob",
  });
