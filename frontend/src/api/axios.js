import axios from "axios";
import { clearPostLoginWelcomeSession } from "../utils/postLoginWelcome";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

let isRedirectingToLogin = false;

const parseJwtPayload = (token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return null;

  const [, payload = ""] = normalizedToken.split(".");
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
};

const isStoredTokenExpired = (token) => {
  const payload = parseJwtPayload(token);
  const expiresAt = Number(payload?.exp || 0);

  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return false;
  }

  return Date.now() >= expiresAt * 1000;
};

const isSessionFailure = (error) => {
  const status = Number(error.response?.status || 0);
  if (status !== 401) return false;

  const responseMessage = String(error.response?.data?.message || "").trim().toLowerCase();
  const token = localStorage.getItem("token");

  if (
    responseMessage.includes("expired token") ||
    responseMessage.includes("invalid token") ||
    responseMessage.includes("expired") ||
    responseMessage.includes("no token")
  ) {
    return true;
  }

  return Boolean(token) && isStoredTokenExpired(token);
};

const redirectToLogin = () => {
  clearPostLoginWelcomeSession();
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

    if (status === 401 && !isLoginRequest && isSessionFailure(error)) {
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
