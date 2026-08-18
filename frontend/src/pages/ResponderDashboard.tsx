import {
  useEffect,
  useState,
} from "react";

import {
  acknowledgeEmergency,
  getActiveEmergencies,
  resolveEmergency,
  type Emergency,
} from "../api/emergency.api";

import { useAuth } from "../context/AuthContext";

const ResponderDashboard = () => {
  const {
    token,
    logout,
  } = useAuth();

  const [
    emergencies,
    setEmergencies,
  ] = useState<Emergency[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadEmergencies = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError("");

      const response =
        await getActiveEmergencies(token);

      setEmergencies(
        response.emergencies
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load emergencies"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmergencies();
  }, [token]);

  const handleAcknowledge = async (
    id: number
  ) => {
    if (!token) return;

    try {
      setError("");

      await acknowledgeEmergency(
        token,
        id
      );

      await loadEmergencies();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to acknowledge emergency"
      );
    }
  };

  const handleResolve = async (
    id: number
  ) => {
    if (!token) return;

    try {
      setError("");

      await resolveEmergency(
        token,
        id
      );

      await loadEmergencies();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to resolve emergency"
      );
    }
  };

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="brand">
            🚨 RoadSOS
          </div>

          <p>
            Responder Dashboard
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={logout}
        >
          Logout
        </button>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <section className="history-section">
        <div className="section-header">
          <div>
            <h1>
              Active Emergencies
            </h1>

            <p>
              Respond to roadside emergencies
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={loadEmergencies}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading emergencies...
          </div>
        ) : emergencies.length === 0 ? (
          <div className="empty-state">
            No active emergencies.
          </div>
        ) : (
          <div className="emergency-list">
            {emergencies.map(
              (emergency) => (
                <article
                  className="emergency-card responder-card"
                  key={emergency.id}
                >
                  <div>
                    <span className="emergency-type">
                      {emergency.emergency_type}
                    </span>

                    <h3>
                      Emergency #{emergency.id}
                    </h3>

                    <p>
                      User:{" "}
                      {emergency.user_name ||
                        "Unknown"}
                    </p>

                    <p>
                      {emergency.message ||
                        "No message provided"}
                    </p>

                    <small>
                      Location:{" "}
                      {emergency.latitude},{" "}
                      {emergency.longitude}
                    </small>

                    <div className="action-row">
                      {emergency.status ===
                        "ACTIVE" && (
                        <button
                          className="primary-button"
                          onClick={() =>
                            handleAcknowledge(
                              emergency.id
                            )
                          }
                        >
                          Acknowledge
                        </button>
                      )}

                      {emergency.status ===
                        "ACKNOWLEDGED" && (
                        <button
                          className="primary-button"
                          onClick={() =>
                            handleResolve(
                              emergency.id
                            )
                          }
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>

                  <span
                    className={`status status-${emergency.status.toLowerCase()}`}
                  >
                    {emergency.status}
                  </span>
                </article>
              )
            )}
          </div>
        )}
      </section>
    </main>
  );
};

export default ResponderDashboard;