import React, { useState } from "react";
import axios from "axios";
import brandLogo from "../assets/Madison-88-Logo-250.png";

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <form onSubmit={handleSubmit} className="auth-card">
        <div className="auth-header">
          <img
            className="brand-logo brand-logo-lg"
            src={brandLogo}
            alt="Madison88"
          />
          <div>
            <h2>Madison88 ITSM</h2>
            <p>Sign in to the service desk.</p>
          </div>
        </div>
        {error && <div className="panel error">{error}</div>}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
