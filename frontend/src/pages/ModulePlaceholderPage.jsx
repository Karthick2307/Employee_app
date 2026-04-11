import { Link } from "react-router-dom";
import { usePermissions } from "../context/PermissionContext";

export default function ModulePlaceholderPage({
  title = "Module",
  description = "This module is permission-ready and can be wired to business workflows next.",
}) {
  const { getHomePath } = usePermissions();

  return (
    <div className="container py-5">
      <div className="page-intro-card module-placeholder-page">
        <div className="page-kicker">Permission Ready</div>
        <h2 className="mb-2">{title}</h2>
        <p className="page-subtitle mb-4">{description}</p>

        <div className="d-flex flex-wrap gap-2">
          <Link className="btn btn-primary" to={getHomePath()}>
            Back To Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
