import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

let isRedirectingToLogin = false;

const redirectToLogin = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  if (typeof window === "undefined" || isRedirectingToLogin) return;
  if (window.location.pathname === "/login") return;

  isRedirectingToLogin = true;
  window.location.replace("/login?reason=session-expired");
};

// 🔐 AUTO ADD TOKEN TO EVERY REQUEST
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || "");
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (status === 401 && !isLoginRequest) {
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
