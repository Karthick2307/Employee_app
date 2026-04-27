import api from "./axios";

export const getCurrentPermissionProfile = () => api.get("/permissions/me");
