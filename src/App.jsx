import React, { useState } from "react";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import "./App.css";

const App = () => {
  const [currentView, setCurrentView] = useState("login");

  const handleLoginSuccess = () => {
    // Navigate to dashboard or main app after successful login
    // Placeholder until routing is added
    // eslint-disable-next-line no-console
    console.log("Login successful");
  };

  const handleSignupSuccess = () => {
    setCurrentView("login");
    // eslint-disable-next-line no-alert
    alert("Account created successfully! Please sign in.");
  };

  return (
    <div className="app">
      {currentView === "login" ? (
        <Login
          onSwitchToSignup={() => setCurrentView("signup")}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : (
        <Signup
          onSwitchToLogin={() => setCurrentView("login")}
          onSignupSuccess={handleSignupSuccess}
        />
      )}
    </div>
  );
};

export default App;

