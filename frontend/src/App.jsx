import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const handleLogin = (jwt, userInfo) => {
    setToken(jwt);
    setUser(userInfo);
    localStorage.setItem("token", jwt);
    localStorage.setItem("user", JSON.stringify(userInfo));
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">
        Welcome, {user?.name || "User"}!
      </h1>
      <p>Your role: {user?.role}</p>
      <button
        className="mt-4 bg-gray-300 px-4 py-2 rounded"
        onClick={() => {
          setToken("");
          setUser(null);
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }}
      >
        Logout
      </button>
    </div>
  );
}

export default App;
