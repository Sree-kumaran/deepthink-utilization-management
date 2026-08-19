import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "../context/RoleContext";

export default function RoleRoute({ allowedRole, children }) {
  const { role } = useRole();
  const location = useLocation();

  if (role !== allowedRole) {
    return <Navigate to={role === "provider" ? "/new-authorization" : "/dashboard"} replace state={{ from: location.pathname }} />;
  }

  return children;
}
