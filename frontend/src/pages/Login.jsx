import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { startPostLoginWelcomeSession } from "../utils/postLoginWelcome";
import loginBackground from "../images/login.jpg";

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
      startPostLoginWelcomeSession(res.data.token || `login-${Date.now()}`);

      navigate("/welcome", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Invalid login ID or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-shell__media" aria-hidden="true">
        <img className="login-shell__photo" src={loginBackground} alt="" />
      </div>
      <div className="login-shell__aurora" aria-hidden="true">
        <span className="login-shell__aurora-blur login-shell__aurora-blur--one" />
        <span className="login-shell__aurora-blur login-shell__aurora-blur--two" />
        <span className="login-shell__aurora-blur login-shell__aurora-blur--three" />
      </div>
      <div className="login-shell__glow login-shell__glow--one" aria-hidden="true" />
      <div className="login-shell__glow login-shell__glow--two" aria-hidden="true" />
      <div className="login-shell__grid" aria-hidden="true" />
      <div className="container py-5 login-shell__content">
        <div className="row justify-content-center">
          <div className="col-12 col-md-9 col-lg-6 col-xl-5">
            <div className="page-intro-card mb-4 text-center login-hero">
              <div className="page-kicker">Welcome</div>
              <h1 className="login-hero__title">Check List Workspace</h1>
            </div>

            <div className={`soft-card login-card${loading ? " login-card--loading" : ""}`}>
              <div className="login-card__signal" aria-hidden="true">
                <span className="login-card__signal-ring login-card__signal-ring--one" />
                <span className="login-card__signal-ring login-card__signal-ring--two" />
              </div>
              {sessionExpired && !error ? (
                <div className="alert alert-warning py-2" role="alert">
                  Session expired. Please log in again.
                </div>
              ) : null}

              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="login-field mb-3">
                  <label className="form-label">Login ID</label>
                  <input
                    type="text"
                    className="form-control login-input"
                    placeholder="Employee code, employee name, or email"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                  />
                </div>

                <div className="login-field mb-4">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control login-input"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <button className="btn btn-primary w-100 login-submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="login-spinner" aria-hidden="true" />
                      Signing in...
                    </>
                  ) : (
                    "Login"
                  )}
                </button>

                <div className="form-help text-center mt-3" aria-live="polite">
                  {loading
                    ? "Checking your credentials and preparing your workspace."
                    : "Use your employee code, employee name, or email to access the dashboard."}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
