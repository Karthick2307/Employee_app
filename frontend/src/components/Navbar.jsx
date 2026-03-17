import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const userDisplayId = user?.email || user?.employeeCode || user?.name || "";
  const employeeMenuPath = user?.id ? `/view/${user.id}` : "/employees";
  const panelTitle = isAdmin ? "Check List Admin Panel" : "Check List User Panel";
  const homePath = "/dashboard";

  const [menuOpen, setMenuOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const closeMenus = () => {
    setMenuOpen(false);
    setMastersOpen(false);
    setReportsOpen(false);
  };

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      <Link className="navbar-brand" to={homePath} onClick={closeMenus}>
        {panelTitle}
      </Link>

      <button
        className="navbar-toggler"
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span className="navbar-toggler-icon"></span>
      </button>

      <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
          <li className="nav-item">
            <Link className="nav-link" to="/dashboard" onClick={closeMenus}>
              Dashboard
            </Link>
          </li>

          <li className="nav-item">
            <Link
              className="nav-link"
              to={isAdmin ? "/employees" : employeeMenuPath}
              onClick={closeMenus}
            >
              Employees
            </Link>
          </li>

          <li className="nav-item">
            <Link className="nav-link" to="/checklists" onClick={closeMenus}>
              {isAdmin ? "Checklist Master" : "My Checklist Tasks"}
            </Link>
          </li>

          {!isAdmin && (
            <li className="nav-item">
              <Link className="nav-link" to="/checklists/approvals" onClick={closeMenus}>
                Approvals
              </Link>
            </li>
          )}

          {isAdmin && (
            <>
              <li className="nav-item dropdown">
                <span
                  className="nav-link dropdown-toggle"
                  role="button"
                  onClick={() => {
                    setReportsOpen((prev) => !prev);
                    setMastersOpen(false);
                  }}
                >
                  Reports
                </span>
                <ul className={`dropdown-menu ${reportsOpen ? "show" : ""}`}>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/reports/checklists"
                      onClick={closeMenus}
                    >
                      Checklist Task Report
                    </Link>
                  </li>
                </ul>
              </li>

              <li className="nav-item">
                <Link className="nav-link" to="/users" onClick={closeMenus}>
                  Users
                </Link>
              </li>

              <li className="nav-item dropdown">
                <span
                  className="nav-link dropdown-toggle"
                  role="button"
                  onClick={() => {
                    setMastersOpen((prev) => !prev);
                    setReportsOpen(false);
                  }}
                >
                  Masters
                </span>

                <ul className={`dropdown-menu ${mastersOpen ? "show" : ""}`}>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/masters/companies"
                      onClick={closeMenus}
                    >
                      Companies
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/masters/departments"
                      onClick={closeMenus}
                    >
                      Departments
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/masters/designations"
                      onClick={closeMenus}
                    >
                      Designations
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/masters/sites"
                      onClick={closeMenus}
                    >
                      Sites
                    </Link>
                  </li>
                </ul>
              </li>
            </>
          )}
        </ul>

        <div className="d-flex align-items-center gap-3">
          <span className="text-white small">{userDisplayId}</span>

          <button onClick={logout} className="btn btn-danger btn-sm">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
