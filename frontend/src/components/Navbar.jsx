import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [open, setOpen] = useState(false);

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-3">
      {/* BRAND */}
      <Link className="navbar-brand" to="/">
        Employee App
      </Link>

      {/* TOGGLER */}
      <button
        className="navbar-toggler"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <span className="navbar-toggler-icon"></span>
      </button>

      {/* MENU */}
      <div className={`collapse navbar-collapse ${open ? "show" : ""}`}>
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">

          {/* DASHBOARD – FIXED */}
          <li className="nav-item">
            <Link
              className="nav-link"
              to="/dashboard"
              onClick={() => setOpen(false)}
            >
              Dashboard
            </Link>
          </li>

          {/* EMPLOYEES */}
          <li className="nav-item">
            <Link
              className="nav-link"
              to="/"
              onClick={() => setOpen(false)}
            >
              Employees
            </Link>
          </li>

          {/* ADMIN ONLY */}
          {isAdmin && (
            <li className="nav-item dropdown">
              <span
                className="nav-link dropdown-toggle"
                role="button"
                onClick={() => setOpen(open => !open)}
              >
                Masters
              </span>

              <ul className={`dropdown-menu ${open ? "show" : ""}`}>
                <li>
                  <Link
                    className="dropdown-item"
                    to="/masters/departments"
                    onClick={() => setOpen(false)}
                  >
                    Departments
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item"
                    to="/masters/designations"
                    onClick={() => setOpen(false)}
                  >
                    Designations
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item"
                    to="/masters/sites"
                    onClick={() => setOpen(false)}
                  >
                    Sites
                  </Link>
                </li>
              </ul>
            </li>
          )}
        </ul>

        {/* RIGHT SIDE */}
        <div className="d-flex align-items-center gap-3">
          <span className="text-white small">
            {user?.email}
          </span>

          <button
            onClick={logout}
            className="btn btn-danger btn-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}