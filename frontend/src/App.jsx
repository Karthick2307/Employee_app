import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";

import Dashboard from "./pages/Dashboard";
import EmployeeList from "./pages/EmployeeList";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeView from "./pages/EmployeeView";
import EmployeeEdit from "./pages/EmployeeEdit";
import Login from "./pages/Login";

import DepartmentMaster from "./pages/masters/DepartmentMaster";
import DesignationMaster from "./pages/masters/DesignationMaster";
import SiteMaster from "./pages/masters/SiteMaster";

/* ================= AUTH HELPERS ================= */

const getUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

const isAdmin = () => getUser()?.role === "admin";

/* ================= ROUTE GUARDS ================= */

const PrivateRoute = ({ children }) => {
  return getUser() ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  if (!getUser()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/employees" replace />;
  return children;
};

/* ================= APP ================= */

export default function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/login";

  return (
    <>
      {!hideNavbar && <Navbar />}

      <Routes>
        {/* ---------------- LOGIN ---------------- */}
        <Route
          path="/login"
          element={
            getUser() ? <Navigate to="/employees" replace /> : <Login />
          }
        />

        {/* ---------------- DASHBOARD ---------------- */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* ---------------- EMPLOYEES ---------------- */}
        <Route
          path="/employees"
          element={
            <PrivateRoute>
              <EmployeeList />
            </PrivateRoute>
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

        {/* ---------------- ADMIN ONLY ---------------- */}
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

        {/* ---------------- DEFAULT ---------------- */}
        <Route path="/" element={<Navigate to="/employees" replace />} />

        {/* ---------------- FALLBACK ---------------- */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}