import axios from "axios";
import { clearPostLoginWelcomeSession } from "../utils/postLoginWelcome";

const API_TIMEOUT_MS = 30000;
const MAX_RETRY_COUNT = 2;
const RETRY_DELAY_MS = 450;
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const trimTrailingSlash = (value) => String(value || "").trim().replace(/\/+$/, "");

const getApiBaseUrl = () => {
  const configuredBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  // Keep API requests same-origin by default.
  // - Vite dev: routed to backend via vite proxy
  // - IIS/production: routed via /api reverse proxy
  if (typeof window !== "undefined") {
    return "/api";
  }

  // Fallback for non-browser usage.
  if (import.meta.env.DEV) {
    return "http://127.0.0.1:5000/api"; 
  }

  return "/api";
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
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

const wait = (duration) =>
  new Promise((resolve) => {
    const timerHost = typeof window !== "undefined" ? window : globalThis;
    timerHost.setTimeout(resolve, duration);
  });

const getFriendlyApiErrorMessage = (error) => {
  if (error.code === "ECONNABORTED") {
    return "The request took too long. Please check your connection and try again.";
  }

  if (!error.response) {
    return "Network connection failed. Please check your internet connection and try again.";
  }

  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    "Something went wrong while contacting the server. Please try again."
  );
};

const attachFriendlyApiErrorMessage = (error) => {
  const userMessage = getFriendlyApiErrorMessage(error);
  error.userMessage = userMessage;

  if (!error.response) {
    error.response = {
      status: 0,
      data: { message: userMessage },
      headers: {},
      config: error.config,
    };
    return;
  }

  if (!error.response.data) {
    error.response.data = { message: userMessage };
    return;
  }

  if (!error.response.data.message && !error.response.data.error) {
    error.response.data.message = userMessage;
  }
};

const shouldRetryRequest = (error) => {
  const config = error.config || {};
  const method = String(config.method || "get").toLowerCase();
  const retryCount = Number(config.__retryCount || 0);
  const status = Number(error.response?.status || 0);

  if (!error.config) return false;
  if (retryCount >= MAX_RETRY_COUNT) return false;
  if (!RETRYABLE_METHODS.has(method)) return false;
  if (status === 401 || status === 403) return false;

  return (
    !error.response ||
    status === 0 ||
    RETRYABLE_STATUS_CODES.has(status) ||
    error.code === "ECONNABORTED"
  );
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
  async (error) => {
    const status = error.response?.status;
    const requestUrl = String(error.config?.url || "");
    const isLoginRequest = requestUrl.includes("/auth/login");

    attachFriendlyApiErrorMessage(error);

    if (status === 401 && !isLoginRequest && isSessionFailure(error)) {
      redirectToLogin();
    }

    if (!isLoginRequest && shouldRetryRequest(error)) {
      const retryCount = Number(error.config.__retryCount || 0) + 1;
      error.config.__retryCount = retryCount;
      await wait(RETRY_DELAY_MS * retryCount);
      return api(error.config);
    }

    return Promise.reject(error);
  }
);

export default api;
