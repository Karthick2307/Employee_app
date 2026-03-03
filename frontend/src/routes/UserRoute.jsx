import { Navigate } from "react-router-dom";

export default function UserRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return <Navigate to="/login" />;

  return children;
}