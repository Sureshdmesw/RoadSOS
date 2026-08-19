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

  /*
  |--------------------------------------------------------------------------
  | Load Emergencies
  |--------------------------------------------------------------------------
  */

  const loadEmergencies = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setError("");
      setLoading(true);

      const response =
        await getActiveEmergencies(token);

      setEmergencies(
        response.emergencies
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load emergency requests"
      );
    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Initial Load
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    loadEmergencies();
  }, [token]);

  /*
  |--------------------------------------------------------------------------
  | Acknowledge Emergency
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Resolve Emergency
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <main className="dashboard">

      {/* ================================================================ */}
      {/* Header                                                           */}
      {/* ================================================================ */}

      <header className="dashboard-header">

        <div>

          <div className="brand">
            🛟 RoadSOS
          </div>

          <p>
            Emergency Response Center
          </p>

        </div>

        <button
          className="secondary-button"
          onClick={logout}
        >
          Logout
        </button>

      </header>


      {/* ================================================================ */}
      {/* Error Message                                                    */}
      {/* ================================================================ */}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}


      {/* ================================================================ */}
      {/* Emergency Requests                                               */}
      {/* ================================================================ */}

      <section className="history-section">

        <div className="section-header">

          <div>

            <h1>
              Emergency Requests
            </h1>

            <p>
              Monitor, acknowledge, and resolve roadside emergencies
            </p>

          </div>


          <button
            className="secondary-button"
            onClick={loadEmergencies}
            disabled={loading}
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

        </div>


        {/* ============================================================ */}
        {/* Loading                                                       */}
        {/* ============================================================ */}

        {loading ? (

          <div className="empty-state">
            Loading emergency requests...
          </div>

        ) : emergencies.length === 0 ? (

          /* ========================================================== */
          /* Empty State                                                 */
          /* ========================================================== */

          <div className="empty-state">

            <h3>
              No active emergency requests
            </h3>

            <p>
              New SOS requests will appear here
              when a user requests roadside assistance.
            </p>

          </div>

        ) : (

          /* ========================================================== */
          /* Emergency List                                               */
          /* ========================================================== */

          <div className="emergency-list">

            {emergencies.map(
              (emergency) => (

                <article
                  className="emergency-card responder-card"
                  key={emergency.id}
                >

                  <div>

                    {/* Emergency Type */}

                    <span className="emergency-type">
                      {emergency.emergency_type}
                    </span>


                    {/* Emergency ID */}

                    <h3>
                      Emergency #{emergency.id}
                    </h3>


                    {/* User Name */}

                    <p>
                      <strong>
                        User:
                      </strong>{" "}
                      {emergency.user_name ||
                        "Unknown"}
                    </p>


                    {/* Emergency Message */}

                    <p>
                      {emergency.message ||
                        "Emergency assistance requested"}
                    </p>


                    {/* Location */}

                    <small>
                      Location:{" "}
                      {emergency.latitude},{" "}
                      {emergency.longitude}
                    </small>


                    {/* ================================================= */}
                    {/* Actions                                             */}
                    {/* ================================================= */}

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
                          Mark Resolved
                        </button>

                      )}

                    </div>

                  </div>


                  {/* ================================================= */}
                  {/* Status Badge                                        */}
                  {/* ================================================= */}

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