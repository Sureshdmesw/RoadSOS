import {
  useEffect,
  useState,
} from "react";

import {
  getMyEmergencies,
  createEmergency,
  type Emergency,
} from "../api/emergency.api";

import { useAuth } from "../context/AuthContext";

const UserDashboard = () => {
  const {
    user,
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
    sosLoading,
    setSosLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const loadEmergencies = async () => {
    if (!token) return;

    try {
      const response =
        await getMyEmergencies(token);

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

  const handleSOS = () => {
    if (!token) return;

    if (!navigator.geolocation) {
      setError(
        "Location services are not supported by this browser."
      );

      return;
    }

    setError("");
    setSosLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await createEmergency(
            token,
            "ACCIDENT",
            position.coords.latitude,
            position.coords.longitude,
            "Emergency assistance requested"
          );

          await loadEmergencies();
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Unable to create emergency"
          );
        } finally {
          setSosLoading(false);
        }
      },
      () => {
        setError(
          "Unable to access your location. Please allow location access."
        );

        setSosLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          <div className="brand">
            🚨 RoadSOS
          </div>

          <p>
            Welcome, {user?.name || "User"}
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

      <section className="sos-section">
        <h1>Need emergency assistance?</h1>

        <p>
          Press the SOS button to send your
          current location to RoadSOS responders.
        </p>

        <button
          className="sos-button"
          onClick={handleSOS}
          disabled={sosLoading}
        >
          {sosLoading ? (
            "SENDING..."
          ) : (
            <>
              🚨
              <span>SOS</span>
            </>
          )}
        </button>

        <p className="sos-note">
          Your browser will request location
          permission.
        </p>
      </section>

      <section className="history-section">
        <div className="section-header">
          <div>
            <h2>My Emergencies</h2>
            <p>
              Your recent emergency requests
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
            No emergency requests yet.
          </div>
        ) : (
          <div className="emergency-list">
            {emergencies.map(
              (emergency) => (
                <article
                  className="emergency-card"
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
                      {emergency.message ||
                        "No message provided"}
                    </p>

                    <small>
                      Location:{" "}
                      {emergency.latitude},{" "}
                      {emergency.longitude}
                    </small>
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

export default UserDashboard;