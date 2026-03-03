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

  if (!data) return <p className="m-4">Loading...</p>;

  return (
    <div className="container mt-4">
      <h4 className="mb-4">Dashboard</h4>

      {/* ===== STAT CARDS ===== */}
      <div className="row mb-4">
        <StatCard title="Total Employees" value={data.total} color="primary" />
        <StatCard title="Active Employees" value={data.active} color="success" />
        <StatCard title="Inactive Employees" value={data.inactive} color="secondary" />
      </div>

      {/* ===== CHART ===== */}
      <div className="card p-3">
        <h6 className="mb-3">Employees by Department (Click bar to filter)</h6>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={data.byDepartment}
            onClick={(state) => {
              if (!state || !state.activePayload) return;

              const deptId = state.activePayload[0].payload._id;
              navigate(`/employees?department=${deptId}`);
            }}
          >
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#0d6efd" cursor="pointer" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ===== CARD COMPONENT ===== */
function StatCard({ title, value, color }) {
  return (
    <div className="col-md-4">
      <div className={`card text-white bg-${color} mb-3`}>
        <div className="card-body text-center">
          <h6>{title}</h6>
          <h2>{value}</h2>
        </div>
      </div>
    </div>
  );
}