import api from "./axios";

export const login = (payload) => api.post("/auth/login", payload);
