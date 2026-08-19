import { useState } from "react";
import type { FormEvent } from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const Register = () => {
  const { register } = useAuth();

  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    // Validate full name
    if (trimmedName.length < 2) {
      setError(
        "Please enter your full name."
      );
      return;
    }

    if (trimmedName.length > 100) {
      setError(
        "Full name cannot exceed 100 characters."
      );
      return;
    }

    // Validate email
    if (!trimmedEmail) {
      setError(
        "Please enter your email address."
      );
      return;
    }

    // Validate password
    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    setLoading(true);

    try {
      await register(
        trimmedName,
        trimmedEmail,
        password
      );

      navigate("/dashboard", {
        replace: true,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="brand">
          🚨 RoadSOS
        </div>

        <h1>Create account</h1>

        <p>
          Create your account to access
          roadside emergency assistance.
        </p>

        {error && (
          <div
            className="error-message"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Full Name */}
        <label htmlFor="name">
          Full name

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Enter your full name"
            autoComplete="name"
            maxLength={100}
            required
            disabled={loading}
          />
        </label>

        {/* Email */}
        <label htmlFor="email">
          Email

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />
        </label>

        {/* Password */}
        <label htmlFor="password">
          Password

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={loading}
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating account..."
            : "Create Account"}
        </button>

        <p className="auth-footer">
          Already have an account?{" "}

          <Link to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
};

export default Register;