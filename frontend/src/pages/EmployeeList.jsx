import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  /* ===== DASHBOARD FILTER ===== */
  const [params] = useSearchParams();
  const department = params.get("department");

  /* ===== USER ROLE ===== */
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  /* ===== LOAD EMPLOYEES ===== */
  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/employees", {
        params: {
          search: search || undefined,
          status: status || undefined,
          department: department || undefined
        }
      });

      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [search, status, department]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees, params.toString()]);

  /* ===== DELETE ===== */
  const removeEmployee = async (id) => {
    if (!window.confirm("Delete employee?")) return;
    try {
      await api.delete(`/employees/${id}`);
      loadEmployees();
    } catch {
      alert("Delete failed");
    }
  };

  /* ===== STATUS TOGGLE ===== */
  const toggleStatus = async (id, currentStatus) => {
    try {
      await api.patch(`/employees/${id}/status`, {
        isActive: !currentStatus
      });
      loadEmployees();
    } catch {
      alert("Status update failed");
    }
  };

  /* ===== EXPORT EXCEL (FIXED) ===== */
  const exportExcel = async () => {
    try {
      const res = await api.get("/employees/export/excel", {
        params: { status },
        responseType: "blob"
      });

      const blob = new Blob([res.data], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employees.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Excel export failed");
    }
  };

  return (
    <div className="container mt-4">
      {/* ===== HEADER ===== */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Employee List</h4>

        {isAdmin && (
          <Link to="/add" className="btn btn-primary">
            + Add Employee
          </Link>
        )}
      </div>

      {/* ===== FILTERS ===== */}
      <div className="d-flex gap-2 mb-3">
        <input
          className="form-control"
          placeholder="Search by code / name / email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="form-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {isAdmin && (
          <button className="btn btn-success" onClick={exportExcel}>
            Export Excel
          </button>
        )}
      </div>

      {/* ===== TABLE ===== */}
      <table className="table table-bordered table-striped">
        <thead className="table-dark">
          <tr>
            <th>Photo</th>
            <th>Code</th>
            <th>Name</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Status</th>
            <th width="260">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan="7" className="text-center">
                Loading...
              </td>
            </tr>
          )}

          {!loading && employees.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center">
                No employees found
              </td>
            </tr>
          )}

          {!loading &&
            employees.map((e) => (
              <tr key={e._id}>
                <td>
                  {e.photo ? (
                    <img
                      src={`http://localhost:5000/uploads/${e.photo}`}
                      alt="emp"
                      width="40"
                      height="40"
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    "-"
                  )}
                </td>

                <td>{e.employeeCode}</td>
                <td>{e.employeeName}</td>
                <td>{e.department?.name || "-"}</td>
                <td>{e.designation?.name || "-"}</td>

                <td>
                  <span
                    className={`badge ${
                      e.isActive ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {e.isActive ? "Active" : "Inactive"}
                  </span>
                </td>

                <td>
                  <Link
                    className="btn btn-sm btn-info me-1"
                    to={`/view/${e._id}`}
                  >
                    View
                  </Link>

                  {isAdmin && (
                    <>
                      <Link
                        className="btn btn-sm btn-warning me-1"
                        to={`/edit/${e._id}`}
                      >
                        Edit
                      </Link>

                      <button
                        className={`btn btn-sm me-1 ${
                          e.isActive ? "btn-secondary" : "btn-success"
                        }`}
                        onClick={() => toggleStatus(e._id, e.isActive)}
                      >
                        {e.isActive ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeEmployee(e._id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}