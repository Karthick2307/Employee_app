import { Link, useLocation } from "react-router-dom";
import { usePermissions } from "../context/usePermissions";

export default function AccessDenied() {
  const location = useLocation();
  const { getHomePath } = usePermissions();
  const fromPath = location.state?.from || "";

  return (
    <div className="container py-5">
      <div className="page-intro-card text-center access-denied-page">
        <div className="page-kicker">Access Control</div>
        <h2 className="mb-2">Access Denied</h2>
        <p className="page-subtitle mb-4">
          You do not currently have permission to open this screen.
          {fromPath ? ` Requested path: ${fromPath}` : ""}
        </p>

        <div className="d-flex flex-wrap justify-content-center gap-2">
          <Link className="btn btn-primary" to={getHomePath()}>
            Open My Allowed Screen
          </Link>
          <Link className="btn btn-outline-secondary" to="/">
            Workspace Home
          </Link>
        </div>
      </div>
    </div>
  );
}

