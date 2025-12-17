import React, { useEffect, useState } from "react";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import RoleSelection from "./components/Onboarding/RoleSelection";
import InviteCodeEntry from "./components/Onboarding/InviteCodeEntry";
import BandCreation from "./components/Onboarding/BandCreation";
import InviteSuccess from "./components/Onboarding/InviteSuccess";
import { bandService } from "./services/bandService";
import "./App.css";

const App = () => {
  const [currentView, setCurrentView] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userBands, setUserBands] = useState([]);
  const [currentBand, setCurrentBand] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setIsAuthenticated(true);
      checkUserBands();
    }
  }, []);

  const checkUserBands = async () => {
    try {
      const bands = await bandService.getUserBands();
      setUserBands(bands);

      if (bands.length > 0) {
        setCurrentView("dashboard");
      } else {
        setCurrentView("roleSelection");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching user bands:", error);
      setCurrentView("roleSelection");
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    checkUserBands();
  };

  const handleSignupSuccess = () => {
    setCurrentView("login");
    // eslint-disable-next-line no-alert
    alert("Account created successfully! Please sign in.");
  };

  const handleRoleSelect = (role, hasInviteCode) => {
    if (role === "band") {
      if (hasInviteCode) {
        setCurrentView("inviteEntry");
      } else {
        setCurrentView("bandCreation");
      }
    } else {
      // eslint-disable-next-line no-alert
      alert("Venue management coming soon!");
    }
  };

  const handleBandCreated = (band) => {
    setCurrentBand(band);
    setCurrentView("inviteSuccess");
  };

  const handleBandJoined = (band) => {
    setCurrentBand(band);
    setCurrentView("joinSuccess");
  };

  const handleContinueToDashboard = () => {
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setIsAuthenticated(false);
    setCurrentView("login");
  };

  const renderView = () => {
    switch (currentView) {
      case "login":
        return (
          <Login
            onSwitchToSignup={() => setCurrentView("signup")}
            onLoginSuccess={handleLoginSuccess}
          />
        );

      case "signup":
        return (
          <Signup
            onSwitchToLogin={() => setCurrentView("login")}
            onSignupSuccess={handleSignupSuccess}
          />
        );

      case "roleSelection":
        return <RoleSelection onRoleSelect={handleRoleSelect} />;

      case "inviteEntry":
        return (
          <InviteCodeEntry
            onSuccess={handleBandJoined}
            onBack={() => setCurrentView("roleSelection")}
          />
        );

      case "bandCreation":
        return (
          <BandCreation
            onSuccess={handleBandCreated}
            onBack={() => setCurrentView("roleSelection")}
          />
        );

      case "inviteSuccess":
        return (
          <InviteSuccess
            band={currentBand}
            onContinue={handleContinueToDashboard}
            isNewBand
          />
        );

      case "joinSuccess":
        return (
          <InviteSuccess
            band={currentBand}
            onContinue={handleContinueToDashboard}
            isNewBand={false}
          />
        );

      case "dashboard":
        return (
          <div className="dashboard-placeholder">
            <h1>Dashboard Coming Soon</h1>
            <p>Band management features will be implemented here</p>
            <button onClick={handleLogout}>Logout</button>
          </div>
        );

      default:
        return <Login onSwitchToSignup={() => setCurrentView("signup")} />;
    }
  };

  return <div className="app">{renderView()}</div>;
};

export default App;

