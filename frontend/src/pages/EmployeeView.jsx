import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

export default function EmployeeView() {
  const { id } = useParams();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    loadEmployee();
    // eslint-disable-next-line
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
    return <div className="container mt-4">Loading...</div>;
  }

  if (!emp) {
    return <div className="container mt-4">Employee not found</div>;
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Employee Details</h4>
        <Link to="/employees" className="btn btn-secondary">
          Back
        </Link>
      </div>

      <div className="card p-4">
        {/* ================= PHOTO ================= */}
        <div className="text-center mb-4">
          {!imgError && emp.photo ? (
            <img
              src={`http://localhost:5000/uploads/${emp.photo}`}
              alt="Employee"
              width="120"
              height="120"
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid #ddd"
              }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#e9ecef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                color: "#6c757d",
                margin: "0 auto"
              }}
            >
              👤
            </div>
          )}
        </div>

        {/* ================= DETAILS ================= */}
        <table className="table table-bordered">
          <tbody>
            <tr>
              <th style={{ width: "30%" }}>Employee Code</th>
              <td>{emp.employeeCode}</td>
            </tr>

            <tr>
              <th>Employee Name</th>
              <td>{emp.employeeName}</td>
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
              <th>Department</th>
              <td>{emp.department?.name || "-"}</td>
            </tr>

            <tr>
              <th>Designation</th>
              <td>{emp.designation?.name || "-"}</td>
            </tr>

            <tr>
              <th>Sites</th>
              <td>
                {emp.sites && emp.sites.length > 0
                  ? emp.sites.map(s => s.name).join(", ")
                  : "-"}
              </td>
            </tr>

            <tr>
              <th>Date Of Joining</th>
              <td>
                {emp.dateOfJoining
                  ? new Date(emp.dateOfJoining).toLocaleDateString()
                  : "-"}
              </td>
            </tr>

            <tr>
              <th>Status</th>
              <td>
                <span
                  className={`badge ${
                    emp.isActive ? "bg-success" : "bg-secondary"
                  }`}
                >
                  {emp.isActive ? "Active" : "Inactive"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ================= ACTIONS ================= */}
        <div className="mt-3">
          {emp.isActive && (
            <Link
              to={`/edit/${emp._id}`}
              className="btn btn-warning me-2"
            >
              Edit
            </Link>
          )}

          <Link to="/employees" className="btn btn-outline-secondary">
            Back to List
          </Link>
        </div>
      </div>
    </div>
  );
}