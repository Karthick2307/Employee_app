import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ChecklistAssistantWidget from "./components/ChecklistAssistantWidget";

import Dashboard from "./pages/Dashboard";
import Dashboard2Summary from "./pages/Dashboard2Summary";
import EmployeeList from "./pages/EmployeeList";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeView from "./pages/EmployeeView";
import EmployeeEdit from "./pages/EmployeeEdit";
import Login from "./pages/Login";
import OwnTasks from "./pages/OwnTasks";
import ChatModule from "./pages/ChatModule";
import UsersAdmin from "./pages/UsersAdmin";
import WelcomeScreen from "./pages/WelcomeScreen";
import ChecklistList from "./pages/checklists/ChecklistList";
import ChecklistCreate from "./pages/checklists/ChecklistCreate";
import ChecklistView from "./pages/checklists/ChecklistView";
import ChecklistTaskView from "./pages/checklists/ChecklistTaskView";
import ChecklistApprovals from "./pages/checklists/ChecklistApprovals";
import ChecklistAdminApprovals from "./pages/checklists/ChecklistAdminApprovals";
import ChecklistReport from "./pages/reports/ChecklistReport";

import CompanyMaster from "./pages/masters/CompanyMaster";
import DepartmentMaster from "./pages/masters/DepartmentMaster";
import DesignationMaster from "./pages/masters/DesignationMaster";
import ChecklistTransferMaster from "./pages/masters/ChecklistTransferMaster";
import SiteMaster from "./pages/masters/SiteMaster";
import {
  getPostLoginDestination,
  getStoredUser,
  shouldShowPostLoginWelcome,
} from "./utils/postLoginWelcome";

const getUser = () => getStoredUser();

const hasSession = () => Boolean(localStorage.getItem("token")) && Boolean(getUser());

const isAdmin = () => getUser()?.role === "admin";

const isEmployeeSession = () => getUser()?.role === "employee";

const hasChecklistMasterAccess = () => {
  const user = getUser();
  return (
    user?.role === "admin" ||
    user?.role === "user" ||
    Boolean(user?.checklistMasterAccess)
  );
};

const canAccessStandardWorkspace = () => isAdmin() || isEmployeeSession();

const getEmployeeViewPath = () => {
  const user = getUser();
  return user?.id ? `/view/${user.id}` : "/login";
};

const getDefaultHomePath = () => {
  const user = getUser();

  if (!user) return "/login";
  if (user.role === "admin") return "/dashboard-1";
  if (user.role === "employee") return getEmployeeViewPath();
  if (user.role === "user" || user.checklistMasterAccess) return "/checklists";

  return "/login";
};

const PrivateRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (shouldShowPostLoginWelcome()) return <Navigate to="/welcome" replace />;
  return children;
};

const StandardWorkspaceRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (shouldShowPostLoginWelcome()) return <Navigate to="/welcome" replace />;
  if (!canAccessStandardWorkspace()) return <Navigate to={getDefaultHomePath()} replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (shouldShowPostLoginWelcome()) return <Navigate to="/welcome" replace />;
  if (!isAdmin()) return <Navigate to={getDefaultHomePath()} replace />;
  return children;
};

const ChecklistMasterRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (shouldShowPostLoginWelcome()) return <Navigate to="/welcome" replace />;
  if (!hasChecklistMasterAccess()) return <Navigate to={getDefaultHomePath()} replace />;
  return children;
};

const WelcomeRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (!shouldShowPostLoginWelcome()) {
    return <Navigate to={getPostLoginDestination(getUser())} replace />;
  }
  return children;
};

const EmployeeIndexRoute = () => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to={getDefaultHomePath()} replace />;
  return <EmployeeList />;
};

export default function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login" || location.pathname === "/welcome";

  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-bs-theme");
    document.body.removeAttribute("data-theme");
    document.body.removeAttribute("data-bs-theme");
    localStorage.removeItem("app-theme");
  }, []);

  return (
    <>
      {!hideNavbar ? <Navbar /> : null}
      {!hideNavbar && hasSession() ? <ChecklistAssistantWidget /> : null}

      <Routes>
        <Route
          path="/login"
          element={
            hasSession() ? (
              <Navigate
                to={
                  shouldShowPostLoginWelcome()
                    ? "/welcome"
                    : getPostLoginDestination(getUser())
                }
                replace
              />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/welcome"
          element={
            <WelcomeRoute>
              <WelcomeScreen />
            </WelcomeRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <StandardWorkspaceRoute>
              <Navigate to={getDefaultHomePath()} replace />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/dashboard-1"
          element={
            <StandardWorkspaceRoute>
              <Dashboard
                pageTitle="Overview 1"
                drilldownVariant="company-site"
                drilldownLayout="columns"
                fullWidth
                showDrilldownCardMarks
                companyOverviewOnly
                companyDetailPath="/dashboard-1/company"
                showEmployeeOverallSection={false}
              />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/dashboard-1/company/:companyId"
          element={
            <StandardWorkspaceRoute>
              <Dashboard
                pageTitle="Overview 1"
                drilldownVariant="company-site"
                drilldownLayout="columns"
                fullWidth
                showDrilldownCardMarks
                hideCompanyStep
                useRouteCompanyId
                companyOverviewPath="/dashboard-1"
                employeeDetailMode="checklists"
              />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/dashboard-2"
          element={
            <StandardWorkspaceRoute>
              <Dashboard
                pageTitle="Overview 2"
                drilldownVariant="company-site"
                markHierarchySource="workflow"
                drilldownLayout="columns"
                fullWidth
                showDrilldownCardMarks
                showSiteLeadStep
                showDepartmentLeadStep
                companyOverviewOnly
                companyDetailPath="/dashboard-2/company"
                showEmployeeOverallSection={false}
              />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/dashboard-2/company/:companyId"
          element={
            <StandardWorkspaceRoute>
              <Dashboard
                pageTitle="Overview 2"
                drilldownVariant="company-site"
                markHierarchySource="workflow"
                drilldownLayout="columns"
                fullWidth
                showDrilldownCardMarks
                showSiteLeadStep
                showDepartmentLeadStep
                hideCompanyStep
                useRouteCompanyId
                companyOverviewPath="/dashboard-2"
                employeeDetailMode="checklists"
              />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/dashboard-summary"
          element={
            <StandardWorkspaceRoute>
              <Dashboard2Summary />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <PrivateRoute>
              <EmployeeIndexRoute />
            </PrivateRoute>
          }
        />

        <Route
          path="/checklists"
          element={
            <PrivateRoute>
              <ChecklistList />
            </PrivateRoute>
          }
        />

        <Route
          path="/checklists/tasks/:id"
          element={
            <PrivateRoute>
              <ChecklistTaskView />
            </PrivateRoute>
          }
        />

        <Route
          path="/checklists/approvals"
          element={
            <PrivateRoute>
              <ChecklistApprovals />
            </PrivateRoute>
          }
        />

        <Route
          path="/checklists/admin-approvals"
          element={
            <AdminRoute>
              <ChecklistAdminApprovals />
            </AdminRoute>
          }
        />

        <Route
          path="/own-tasks"
          element={
            <PrivateRoute>
              <OwnTasks />
            </PrivateRoute>
          }
        />

        <Route
          path="/own-tasks/:id"
          element={
            <PrivateRoute>
              <OwnTasks />
            </PrivateRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <StandardWorkspaceRoute>
              <ChatModule key="site-chat" chatType="site" apiBasePath="/chat" />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/department-chat"
          element={
            <StandardWorkspaceRoute>
              <ChatModule
                key="department-chat"
                chatType="department"
                apiBasePath="/department-chat"
              />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/reports/checklists"
          element={
            <AdminRoute>
              <ChecklistReport />
            </AdminRoute>
          }
        />

        <Route
          path="/view/:id"
          element={
            <StandardWorkspaceRoute>
              <EmployeeView />
            </StandardWorkspaceRoute>
          }
        />

        <Route
          path="/add"
          element={
            <AdminRoute>
              <EmployeeForm />
            </AdminRoute>
          }
        />

        <Route
          path="/edit/:id"
          element={
            <AdminRoute>
              <EmployeeEdit />
            </AdminRoute>
          }
        />

        <Route
          path="/masters/companies"
          element={
            <AdminRoute>
              <CompanyMaster />
            </AdminRoute>
          }
        />

        <Route
          path="/masters/departments"
          element={
            <AdminRoute>
              <DepartmentMaster />
            </AdminRoute>
          }
        />

        <Route
          path="/masters/designations"
          element={
            <AdminRoute>
              <DesignationMaster />
            </AdminRoute>
          }
        />

        <Route
          path="/masters/sites"
          element={
            <AdminRoute>
              <SiteMaster />
            </AdminRoute>
          }
        />

        <Route
          path="/masters/checklists"
          element={
            <ChecklistMasterRoute>
              <Navigate to="/checklists" replace />
            </ChecklistMasterRoute>
          }
        />

        <Route
          path="/masters/checklist-transfer"
          element={
            <ChecklistMasterRoute>
              <ChecklistTransferMaster />
            </ChecklistMasterRoute>
          }
        />

        <Route
          path="/checklists/create"
          element={
            <ChecklistMasterRoute>
              <ChecklistCreate />
            </ChecklistMasterRoute>
          }
        />

        <Route
          path="/checklists/edit/:id"
          element={
            <ChecklistMasterRoute>
              <ChecklistCreate mode="edit" />
            </ChecklistMasterRoute>
          }
        />

        <Route
          path="/checklists/:id"
          element={
            <ChecklistMasterRoute>
              <ChecklistView />
            </ChecklistMasterRoute>
          }
        />

        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersAdmin />
            </AdminRoute>
          }
        />

        <Route
          path="/"
          element={
            <Navigate
              to={
                hasSession()
                  ? shouldShowPostLoginWelcome()
                    ? "/welcome"
                    : getDefaultHomePath()
                  : "/login"
              }
              replace
            />
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
