import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import apiClient from "../api/client";
import brandLogo from "../assets/Madison-88-Logo-250.png";
import { isBlank, isEmail } from "../utils/validation";

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  const location = useLocation();

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMsg(location.state.message);
    }
  }, [location]);

  // Modals logic preserved for consistency
  const headingStyle = { color: '#1976d2', fontWeight: 'bold', marginBottom: 8 };
  const subheadingStyle = { color: '#1976d2', fontWeight: 'bold', marginTop: 24, marginBottom: 8 };
  const labelStyle = { color: '#1976d2', fontWeight: 'bold' };
  const textStyle = { color: '#222', fontWeight: 'normal' };

  const handleShowModal = (type) => {
    setModalOpen(true);
    if (type === 'terms') {
      setModalContent(
        <div style={{ textAlign: 'left', maxHeight: '60vh', overflowY: 'auto', fontSize: '1rem' }}>
          <h2 style={headingStyle}>Terms and Conditions of Use</h2>
          <h3 style={subheadingStyle}>EXECUTIVE SUMMARY</h3>
          <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16, background: '#faf9f6', ...textStyle }}>
            These Terms and Conditions govern your access to and use of the Madison 88 ITSM System. By accessing or using our IT services, ticket management, and asset tracking tools, you acknowledge that you have read, understood, and agree to be bound by these corporate IT policies and all applicable digital regulations.
          </div>
          <h3 style={subheadingStyle}>ACCEPTANCE OF TERMS & CONDITIONS</h3>
          <span style={labelStyle}>BINDING AGREEMENT</span>
          <div style={{ borderLeft: '3px solid #1976d2', paddingLeft: 12, marginBottom: 8, ...textStyle }}>
            By logging into the Madison 88 ITSM System, you acknowledge that you have read these Terms and Conditions in their entirety and agree to be legally bound by all provisions regarding internal IT resource usage. If you do not agree with any part of these terms, you must immediately cease usage and contact your System Administrator.
          </div>
        </div>
      );
    } else if (type === 'privacy') {
      setModalContent(
        <div style={{ textAlign: 'left', maxHeight: '60vh', overflowY: 'auto', fontSize: '1rem' }}>
          <h2 style={headingStyle}>Privacy Policy &amp; Data Protection Notice</h2>
          {/* ... Content ... */}
          <p style={textStyle}>Our data processing activities are conducted in accordance with Republic Act No. 10173 and Madison 88 internal compliance frameworks.</p>
        </div>
      );
    }
  };
  const handleCloseModal = () => setModalOpen(false);

  const handleLocalSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (isBlank(email)) return setError("Email is required.");
    if (!isEmail(email)) return setError("Enter a valid email address.");
    if (isBlank(password)) return setError("Password is required.");

    setLoading(true);
    try {
      const res = await apiClient.post("/api/auth/login", { email, password });
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <img
            className="brand-logo brand-logo-lg"
            src={brandLogo}
            alt="Madison88"
          />
        </div>
        <p className="auth-subtitle">Sign in to the service desk.</p>

        {successMsg && (
          <div className="panel success auth-alert" style={{ background: 'rgba(55, 217, 150, 0.15)', border: '1px solid rgba(55, 217, 150, 0.3)', color: '#37d996', padding: '12px', borderRadius: '12px', marginBottom: '12px', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        {(error) && (
          <div className="panel error auth-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLocalSubmit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button
            type="submit"
            className="btn primary"
            style={{ width: "100%" }}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-note">
          Don't have an account? <Link to="/signup" className="terms-link">Sign Up</Link>
        </p>

        <p className="terms-notice">
          By logging in, you agree to our{' '}
          <a href="#" onClick={e => { e.preventDefault(); handleShowModal('terms'); }} className="terms-link">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="#" onClick={e => { e.preventDefault(); handleShowModal('privacy'); }} className="terms-link">
            Privacy Policy
          </a>
          .
        </p>

        {modalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-content" style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 700, width: '95%', boxShadow: '0 2px 16px rgba(0,0,0,0.2)', overflowY: 'auto', maxHeight: '90vh', fontFamily: 'inherit' }}>
              <button onClick={handleCloseModal} style={{ float: 'right', background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#1976d2' }} title="Close">&times;</button>
              <div style={{ clear: 'both' }}></div>
              {modalContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
