import {
  Navigate,
  Outlet,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: Array<
    "USER" | "RESPONDER" | "ADMIN"
  >;
}

const ProtectedRoute = ({
  allowedRoles,
}: ProtectedRouteProps) => {
  const {
    user,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        Loading RoadSOS...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;