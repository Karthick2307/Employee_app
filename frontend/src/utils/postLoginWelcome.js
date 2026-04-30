const LOGIN_SESSION_STORAGE_KEY = "checklist-login-session-id";
const DISMISSED_SESSION_STORAGE_KEY = "checklist-login-welcome-dismissed";

const getSessionStorage = () =>
  typeof window !== "undefined" ? window.sessionStorage : null;

const getLocalStorage = () =>
  typeof window !== "undefined" ? window.localStorage : null;

export const getStoredUser = () => {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem("user");
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
};

export const getPostLoginDestination = (user = getStoredUser()) => {
  if (!user) return "/login";
  if (user.homePath) return user.homePath;

  if (
    user.role === "admin" ||
    user.isDefaultAdmin ||
    user.roleKey === "main_admin"
  ) {
    return "/employees";
  }

  if (
    user.role === "employee" ||
    user.principalType === "employee" ||
    user.roleKey === "employee"
  ) {
    return "/checklists";
  }

  if (user.role === "user" || user.checklistMasterAccess) {
    return "/checklists";
  }

  return "/employees";
};

export const startPostLoginWelcomeSession = (sessionId = `login-${Date.now()}`) => {
  const storage = getSessionStorage();
  if (!storage) return "";

  storage.setItem(LOGIN_SESSION_STORAGE_KEY, sessionId);
  storage.removeItem(DISMISSED_SESSION_STORAGE_KEY);

  return sessionId;
};

export const getPostLoginWelcomeSessionId = () => {
  const storage = getSessionStorage();
  if (!storage) return "";

  return storage.getItem(LOGIN_SESSION_STORAGE_KEY) || "";
};

export const shouldShowPostLoginWelcome = () => {
  const storage = getSessionStorage();
  if (!storage) return false;

  const sessionId = storage.getItem(LOGIN_SESSION_STORAGE_KEY) || "";
  if (!sessionId) return false;

  return storage.getItem(DISMISSED_SESSION_STORAGE_KEY) !== sessionId;
};

export const dismissPostLoginWelcome = () => {
  const storage = getSessionStorage();
  if (!storage) return;

  const sessionId = storage.getItem(LOGIN_SESSION_STORAGE_KEY) || "";
  if (!sessionId) return;

  storage.setItem(DISMISSED_SESSION_STORAGE_KEY, sessionId);
};

export const clearPostLoginWelcomeSession = () => {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.removeItem(LOGIN_SESSION_STORAGE_KEY);
  storage.removeItem(DISMISSED_SESSION_STORAGE_KEY);
};
