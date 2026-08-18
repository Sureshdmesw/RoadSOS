import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import UserDashboard from "./pages/UserDashboard";
import ResponderDashboard from "./pages/ResponderDashboard";

import "./App.css";

const DashboardRedirect = () => {
  const { user } = useAuth();

  if (
    user?.role === "RESPONDER" ||
    user?.role === "ADMIN"
  ) {
    return (
      <Navigate
        to="/responder"
        replace
      />
    );
  }

  return (
    <Navigate
      to="/user"
      replace
    />
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route element={<ProtectedRoute />}>
            <Route
              path="/dashboard"
              element={<DashboardRedirect />}
            />

            <Route
              path="/user"
              element={<UserDashboard />}
            />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={[
                  "RESPONDER",
                  "ADMIN",
                ]}
              />
            }
          >
            <Route
              path="/responder"
              element={
                <ResponderDashboard />
              }
            />
          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;