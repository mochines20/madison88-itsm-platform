import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import brandLogo from "../assets/Madison-88-Logo-250.png";

const Login = () => {
    const { loginWithRedirect } = useAuth0();

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <img src={brandLogo} alt="Madison88" className="login-logo" />
                    <h1>Help Desk Portal</h1>
                    <p>Sign in to manage tickets and support requests</p>
                </div>
                <button
                    className="btn primary full-width"
                    onClick={() => loginWithRedirect()}
                >
                    Sign In
                </button>
            </div>
        </div>
    );
};

export default Login;
