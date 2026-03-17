import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";

export default function Login() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        loginId: loginId.trim(),
        password: password.trim(),
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user?.role === "admin") {
        navigate("/users");
      } else {
        navigate(res.data.user?.id ? `/view/${res.data.user.id}` : "/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid login ID or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: "400px" }}>
      <h4 className="text-center mb-3">Employee / Admin Login</h4>

      <div className="alert alert-info py-2">
        Default admin: <strong>admin@test.com</strong> / <strong>123456</strong>
      </div>

      <div className="alert alert-secondary py-2">
        Employees can log in using <strong>Employee Code</strong>, <strong>Employee Name</strong>,
        {" "}or <strong>Email</strong> with their employee password.
      </div>

      {sessionExpired && !error && (
        <div className="alert alert-warning py-2">
          Session expired. Please log in again.
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="form-control mb-2"
          placeholder="Login ID / Employee Code / Employee Name / Email"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
        />

        <input
          type="password"
          className="form-control mb-3"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="btn btn-primary w-100" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
