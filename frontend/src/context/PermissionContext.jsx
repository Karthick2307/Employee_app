import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { getPostLoginDestination, getStoredUser } from "../utils/postLoginWelcome";

const PermissionContext = createContext(null);

const hasSession = () => Boolean(localStorage.getItem("token")) && Boolean(getStoredUser());

const defaultState = {
  loading: false,
  user: getStoredUser(),
  role: null,
  modules: [],
  permissions: {},
  scope: {
    strategy: "mapped",
    companyIds: [],
    siteIds: [],
    departmentIds: [],
    subDepartmentIds: [],
    employeeIds: [],
  },
  homePath: getPostLoginDestination(getStoredUser()),
};

export function PermissionProvider({ children }) {
  const [state, setState] = useState(() => ({
    ...defaultState,
    loading: hasSession(),
  }));

  useEffect(() => {
    let active = true;

    if (!hasSession()) {
      setState({
        ...defaultState,
        loading: false,
      });
      return undefined;
    }

    const loadPermissions = async () => {
      setState((currentValue) => ({
        ...currentValue,
        loading: true,
      }));

      try {
        const response = await api.get("/permissions/me");
        if (!active) return;

        const nextUser = response.data?.user || getStoredUser();
        if (nextUser) {
          localStorage.setItem("user", JSON.stringify(nextUser));
        }

        setState({
          loading: false,
          user: nextUser,
          role: response.data?.role || null,
          modules: Array.isArray(response.data?.modules) ? response.data.modules : [],
          permissions: response.data?.permissions || {},
          scope: response.data?.scope || defaultState.scope,
          homePath:
            response.data?.homePath ||
            nextUser?.homePath ||
            getPostLoginDestination(nextUser),
        });
      } catch (error) {
        if (!active) return;

        const fallbackUser = getStoredUser();
        setState({
          loading: false,
          user: fallbackUser,
          role: null,
          modules: [],
          permissions: {},
          scope: defaultState.scope,
          homePath: getPostLoginDestination(fallbackUser),
        });
      }
    };

    void loadPermissions();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => {
    const moduleMap = new Map((state.modules || []).map((moduleItem) => [moduleItem.key, moduleItem]));

    const can = (moduleKey, actionKey = "view") => {
      const permissionRow = state.permissions?.[moduleKey];
      if (!permissionRow) return false;

      const actionFieldMap = {
        view: "canView",
        add: "canAdd",
        edit: "canEdit",
        delete: "canDelete",
        approve: "canApprove",
        reject: "canReject",
        status_update: "canStatusUpdate",
        transfer: "canTransfer",
        export: "canExport",
        report_view: "canReportView",
      };

      return Boolean(permissionRow[actionFieldMap[actionKey]]);
    };

    const canAny = (permissionChecks = []) =>
      permissionChecks.some(({ moduleKey, actionKey = "view" }) => can(moduleKey, actionKey));

    const getModule = (moduleKey) => moduleMap.get(moduleKey) || null;
    const getVisibleModules = () =>
      (state.modules || []).filter((moduleItem) => can(moduleItem.key, "view"));
    const getHomePath = () =>
      state.homePath ||
      state.user?.homePath ||
      getPostLoginDestination(state.user);

    return {
      ...state,
      can,
      canAny,
      getHomePath,
      getModule,
      getVisibleModules,
      refresh: async () => {
        const response = await api.get("/permissions/me");
        const nextUser = response.data?.user || getStoredUser();

        if (nextUser) {
          localStorage.setItem("user", JSON.stringify(nextUser));
        }

        setState({
          loading: false,
          user: nextUser,
          role: response.data?.role || null,
          modules: Array.isArray(response.data?.modules) ? response.data.modules : [],
          permissions: response.data?.permissions || {},
          scope: response.data?.scope || defaultState.scope,
          homePath:
            response.data?.homePath ||
            nextUser?.homePath ||
            getPostLoginDestination(nextUser),
        });
      },
    };
  }, [state]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

export const usePermissions = () => {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error("usePermissions must be used inside PermissionProvider");
  }

  return context;
};
