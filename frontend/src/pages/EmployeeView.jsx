import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { formatDepartmentList } from "../utils/departmentDisplay";
import { formatSiteList } from "../utils/siteDisplay";

const getEmployeeInitial = (employee) =>
  String(employee?.employeeName || employee?.employeeCode || "?")
    .trim()
    .charAt(0)
    .toUpperCase() || "?";

export default function EmployeeView() {
  const { id } = useParams();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";
  const backPath = isAdmin ? "/employees" : "/dashboard";
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );

  useEffect(() => {
    loadEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadEmployee = async () => {
    try {
      const res = await api.get(`/employees/${id}`);
      setEmp(res.data);
    } catch (err) {
      console.error("Failed to load employee", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 app-legacy-shell">
        <div className="page-intro-card">Loading employee details...</div>
      </div>
    );
  }

  if (!emp) {
    return (
      <div className="container mt-4 app-legacy-shell">
        <div className="alert alert-danger">Employee not found.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4 app-legacy-shell">
      <div className="page-intro-card mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="page-kicker">Employee</div>
            <h4 className="mb-1">Employee Details</h4>
            <p className="page-subtitle mb-0">
              View employee profile, reporting details, site assignment, and current status.
            </p>
          </div>
          <Link to={backPath} className="btn btn-outline-secondary">
            Back
          </Link>
        </div>
      </div>

      <div className="app-legacy-card p-4">
        <div className="text-center mb-4">
          {!imgError && emp.photo ? (
            <img
              src={`${uploadBaseUrl}/uploads/${emp.photo}`}
              alt="Employee"
              width="120"
              height="120"
              className="app-avatar"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="app-avatar-fallback app-avatar-fallback--lg">
              {getEmployeeInitial(emp)}
            </div>
          )}
          <div className="mt-3">
            <h5 className="mb-1">{emp.employeeName || "-"}</h5>
            <div className="form-help">{emp.employeeCode || "Employee code not available"}</div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0">
            <tbody>
              <tr>
                <th style={{ width: "30%" }}>Employee Code</th>
                <td>{emp.employeeCode || "-"}</td>
              </tr>
              <tr>
                <th>Employee Name</th>
                <td>{emp.employeeName || "-"}</td>
              </tr>
              <tr>
                <th>Mobile</th>
                <td>{emp.mobile || "-"}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td>{emp.email || "-"}</td>
              </tr>
              <tr>
                <th>Departments</th>
                <td>
                  {emp.departmentDisplay ||
                    formatDepartmentList(emp.departmentDetails || emp.department) ||
                    "-"}
                </td>
              </tr>
              <tr>
                <th>Sub Departments</th>
                <td>
                  {emp.subDepartmentDisplay ||
                    emp.subDepartmentPath ||
                    emp.subDepartmentName ||
                    "-"}
                </td>
              </tr>
              <tr>
                <th>Designation</th>
                <td>{emp.designation?.name || "-"}</td>
              </tr>
              <tr>
                <th>Superior Employee</th>
                <td>{emp.superiorEmployeeName || "-"}</td>
              </tr>
              <tr>
                <th>Sites</th>
                <td>{emp.sites?.length ? formatSiteList(emp.sites) : "-"}</td>
              </tr>
              <tr>
                <th>Sub Sites</th>
                <td>{emp.subSiteDisplay || "-"}</td>
              </tr>
              <tr>
                <th>Date Of Joining</th>
                <td>
                  {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : "-"}
                </td>
              </tr>
              <tr>
                <th>Status</th>
                <td>
                  <span className={`badge ${emp.isActive ? "bg-success" : "bg-secondary"}`}>
                    {emp.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 d-flex flex-wrap gap-2">
          {isAdmin && emp.isActive ? (
            <Link to={`/edit/${emp._id}`} className="btn btn-warning">
              Edit
            </Link>
          ) : null}

          {!isAdmin ? (
            <Link to="/own-tasks" className="btn btn-primary">
              Own Tasks
            </Link>
          ) : null}

          <Link to={backPath} className="btn btn-outline-secondary">
            {isAdmin ? "Back to List" : "Back"}
          </Link>
        </div>
      </div>
    </div>
  );
}
