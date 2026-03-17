import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import EmployeeList from "./pages/EmployeeList";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeView from "./pages/EmployeeView";
import EmployeeEdit from "./pages/EmployeeEdit";
import Login from "./pages/Login";
import UsersAdmin from "./pages/UsersAdmin";
import ChecklistList from "./pages/checklists/ChecklistList";
import ChecklistCreate from "./pages/checklists/ChecklistCreate";
import ChecklistView from "./pages/checklists/ChecklistView";
import ChecklistTaskView from "./pages/checklists/ChecklistTaskView";
import ChecklistApprovals from "./pages/checklists/ChecklistApprovals";
import ChecklistReport from "./pages/reports/ChecklistReport";

import CompanyMaster from "./pages/masters/CompanyMaster";
import DepartmentMaster from "./pages/masters/DepartmentMaster";
import DesignationMaster from "./pages/masters/DesignationMaster";
import SiteMaster from "./pages/masters/SiteMaster";

const getUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

const hasSession = () => Boolean(localStorage.getItem("token")) && Boolean(getUser());

const isAdmin = () => getUser()?.role === "admin";

const getEmployeeViewPath = () => {
  const user = getUser();
  return user?.id ? `/view/${user.id}` : "/login";
};

const PrivateRoute = ({ children }) => {
  return hasSession() ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to={getEmployeeViewPath()} replace />;
  return children;
};

const EmployeeIndexRoute = () => {
  if (!hasSession()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to={getEmployeeViewPath()} replace />;
  return <EmployeeList />;
};

export default function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login";

  return (
    <>
      {!hideNavbar && <Navbar />}

      <Routes>
        <Route
          path="/login"
          element={
            hasSession() ? (
              <Navigate to={isAdmin() ? "/users" : getEmployeeViewPath()} replace />
            ) : (
              <Login />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
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
            <PrivateRoute>
              <EmployeeView />
            </PrivateRoute>
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
            <AdminRoute>
              <Navigate to="/checklists" replace />
            </AdminRoute>
          }
        />

        <Route
          path="/checklists/create"
          element={
            <AdminRoute>
              <ChecklistCreate />
            </AdminRoute>
          }
        />

        <Route
          path="/checklists/edit/:id"
          element={
            <AdminRoute>
              <ChecklistCreate mode="edit" />
            </AdminRoute>
          }
        />

        <Route
          path="/checklists/:id"
          element={
            <AdminRoute>
              <ChecklistView />
            </AdminRoute>
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
          element={<Navigate to={isAdmin() ? "/users" : getEmployeeViewPath()} replace />}
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
