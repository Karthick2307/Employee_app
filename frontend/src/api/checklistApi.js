import api from "./axios";

export const getChecklistList = (params) => api.get("/checklists", { params });
export const runChecklistScheduler = () => api.post("/checklists/run-scheduler");
export const exportChecklistList = (params) =>
  api.get("/checklists/export/excel", {
    params,
    responseType: "blob",
  });
