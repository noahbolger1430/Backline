import React, { useEffect, useState } from "react";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import RoleSelection from "./components/Onboarding/RoleSelection";
import InviteCodeEntry from "./components/Onboarding/InviteCodeEntry";
import BandCreation from "./components/Onboarding/BandCreation";
import InviteSuccess from "./components/Onboarding/InviteSuccess";
import BandDashboard from "./components/Dashboard/BandDashboard";
import VenueInviteEntry from "./components/Onboarding/VenueInviteEntry";
import VenueCreation from "./components/Onboarding/VenueCreation";
import VenueSuccess from "./components/Onboarding/VenueSuccess";
import { bandService } from "./services/bandService";
import { venueService } from "./services/venueService";
import "./App.css";

const App = () => {
  const [currentView, setCurrentView] = useState("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userBands, setUserBands] = useState([]);
  const [userVenues, setUserVenues] = useState([]);
  const [currentBand, setCurrentBand] = useState(null);
  const [currentVenue, setCurrentVenue] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setIsAuthenticated(true);
      checkUserEntities();
    }
  }, []);

  const checkUserEntities = async () => {
    try {
      const [bands, venues] = await Promise.all([
        bandService.getUserBands(),
        venueService.getUserVenues(),
      ]);

      setUserBands(bands);
      setUserVenues(venues);

      if (bands.length > 0 || venues.length > 0) {
        setCurrentView("dashboard");
      } else {
        setCurrentView("roleSelection");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching user entities:", error);
      setCurrentView("roleSelection");
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    checkUserEntities();
  };

  const handleSignupSuccess = () => {
    setCurrentView("login");
    // eslint-disable-next-line no-alert
    alert("Account created successfully! Please sign in.");
  };

  const handleRoleSelect = (role, hasInviteCode) => {
    if (role === "band") {
      if (hasInviteCode) {
        setCurrentView("bandInviteEntry");
      } else {
        setCurrentView("bandCreation");
      }
    } else if (role === "venue") {
      if (hasInviteCode) {
        setCurrentView("venueInviteEntry");
      } else {
        setCurrentView("venueCreation");
      }
    }
  };

  const handleBandCreated = (band) => {
    setCurrentBand(band);
    setCurrentView("bandSuccess");
  };

  const handleBandJoined = (band) => {
    setCurrentBand(band);
    setCurrentView("bandJoinSuccess");
  };

  const handleVenueCreated = (venue) => {
    setCurrentVenue(venue);
    setCurrentView("venueSuccess");
  };

  const handleVenueJoined = (venue) => {
    setCurrentVenue(venue);
    setCurrentView("venueJoinSuccess");
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

      case "bandInviteEntry":
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

      case "bandSuccess":
        return (
          <InviteSuccess
            band={currentBand}
            onContinue={handleContinueToDashboard}
            isNewBand
          />
        );

      case "bandJoinSuccess":
        return (
          <InviteSuccess
            band={currentBand}
            onContinue={handleContinueToDashboard}
            isNewBand={false}
          />
        );

      case "venueInviteEntry":
        return (
          <VenueInviteEntry
            onSuccess={handleVenueJoined}
            onBack={() => setCurrentView("roleSelection")}
          />
        );

      case "venueCreation":
        return (
          <VenueCreation
            onSuccess={handleVenueCreated}
            onBack={() => setCurrentView("roleSelection")}
          />
        );

      case "venueSuccess":
        return (
          <VenueSuccess
            venue={currentVenue}
            onContinue={handleContinueToDashboard}
            isNewVenue
          />
        );

      case "venueJoinSuccess":
        return (
          <VenueSuccess
            venue={currentVenue}
            onContinue={handleContinueToDashboard}
            isNewVenue={false}
          />
        );

      case "dashboard":
        if (userBands.length > 0) {
          return <BandDashboard />;
        }

        return (
          <div className="dashboard-placeholder">
            <h1>Welcome to BackLine</h1>
            <p>Get started by creating or joining a band or venue</p>
            <button onClick={() => setCurrentView("roleSelection")}>Get Started</button>
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

