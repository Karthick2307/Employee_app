import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await api.get("/dashboard");
      setData(res.data);
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  };

  const openDepartmentEmployees = (entry) => {
    const departmentId = entry?._id || entry?.payload?._id;
    if (!departmentId) return;
    navigate(`/employees?department=${departmentId}`);
  };

  if (!data) return <p className="m-4">Loading...</p>;

  return (
    <div className="container mt-4 mb-5">
      <h4 className="mb-4">Dashboard</h4>

      {/* ===== STAT CARDS ===== */}
      <div className="row g-3 mb-4">
        <StatCard title="Total Employees" value={data.total} color="primary" />
        <StatCard title="Active Employees" value={data.active} color="success" />
        <StatCard title="Inactive Employees" value={data.inactive} color="secondary" />
        <StatCard title="Checklist Tasks" value={data.totalChecklistTasks || 0} color="info" />
      </div>

      {/* ===== CHART ===== */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h6 className="mb-3">Employees by Department</h6>
          <small className="text-muted d-block mb-3">
            Click a department bar to open the employees page with that department filter.
          </small>

          {data.byDepartment?.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.byDepartment}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#0d6efd"
                  cursor="pointer"
                  onClick={openDepartmentEmployees}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-muted">No department data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== CARD COMPONENT ===== */
function StatCard({ title, value, color }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className={`card text-white bg-${color} h-100`}>
        <div className="card-body text-center">
          <h6>{title}</h6>
          <h2>{value}</h2>
        </div>
      </div>
    </div>
  );
}
