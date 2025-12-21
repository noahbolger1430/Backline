import React, { useEffect, useState } from "react";
import Login from "./components/Auth/Login";
import Signup from "./components/Auth/Signup";
import RoleSelection from "./components/Onboarding/RoleSelection";
import InviteCodeEntry from "./components/Onboarding/InviteCodeEntry";
import BandCreation from "./components/Onboarding/BandCreation";
import InviteSuccess from "./components/Onboarding/InviteSuccess";
import BandDashboard from "./components/Dashboard/BandDashboard";
import VenueDashboard from "./components/Dashboard/VenueDashboard";
import VenueInviteEntry from "./components/Onboarding/VenueInviteEntry";
import VenueCreation from "./components/Onboarding/VenueCreation";
import VenueSuccess from "./components/Onboarding/VenueSuccess";
import { bandService } from "./services/bandService";
import { venueService } from "./services/venueService";
import "./App.css";

const App = () => {
  // DEV MODE: Change to "bandDashboard" or "venueDashboard" to preview
  const [currentView, setCurrentView] = useState("login"); // or "venueDashboard"
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userBands, setUserBands] = useState([]);
  const [userVenues, setUserVenues] = useState([]);
  const [currentBand, setCurrentBand] = useState(null);
  const [currentVenue, setCurrentVenue] = useState(null);
  const [isCheckingEntities, setIsCheckingEntities] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setIsAuthenticated(true);
      setIsCheckingEntities(true);
      checkUserEntities();
    }
  }, []);

  const checkUserEntities = async () => {
    try {
      setIsCheckingEntities(true);
      
      // Add timeout wrapper function
      const withTimeout = (promise, timeoutMs = 10000) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Request timeout - backend may not be running")), timeoutMs)
          )
        ]);
      };
      
      // Use allSettled to get results from both calls even if one fails
      let bandsResult, venuesResult;
      try {
        const results = await withTimeout(
          Promise.allSettled([
            bandService.getUserBands(),
            venueService.getUserVenues(),
          ])
        );
        bandsResult = results[0];
        venuesResult = results[1];
      } catch (timeoutError) {
        // Timeout or network error - treat both calls as failed
        console.error("Network error or timeout:", timeoutError);
        bandsResult = { status: 'rejected', reason: timeoutError };
        venuesResult = { status: 'rejected', reason: timeoutError };
      }
      
      // Check for 401 errors first (authentication failure)
      const errors = [bandsResult, venuesResult].filter(r => r.status === 'rejected').map(r => r.reason);
      const has401Error = errors.some(err => err?.status === 401);
      const hasTimeout = errors.some(err => err?.isTimeout || err?.status === 408);
      
      if (has401Error) {
        // Unauthorized - clear token and go to login
        localStorage.removeItem("access_token");
        setIsAuthenticated(false);
        setCurrentView("login");
        setIsCheckingEntities(false);
        return;
      }
      
      // If we have timeouts, log them but continue with empty arrays
      if (hasTimeout) {
        console.warn("Some API calls timed out. Backend may be slow or unavailable.");
      }
      
      // Extract values, defaulting to empty arrays on error
      const bands = bandsResult.status === 'fulfilled' ? bandsResult.value : [];
      const venues = venuesResult.status === 'fulfilled' ? venuesResult.value : [];
      
      // Log any errors for debugging
      if (bandsResult.status === 'rejected') {
        console.error("Error fetching bands:", bandsResult.reason);
      }
      if (venuesResult.status === 'rejected') {
        console.error("Error fetching venues:", venuesResult.reason);
      }
      
      console.log("bands", bands);
      console.log("venues", venues);

      // Ensure bands and venues are arrays (defensive check)
      const bandsArray = Array.isArray(bands) ? bands : [];
      const venuesArray = Array.isArray(venues) ? venues : [];
      
      // If API returns empty but we have currentBand, use it as fallback
      let finalBands = bandsArray;
      if (bandsArray.length === 0 && currentBand) {
        finalBands = [currentBand];
      }

      setUserBands(finalBands);
      setUserVenues(venuesArray);

      const bandsLength = finalBands.length;
      const venuesLength = venuesArray.length;
      if (bandsLength > 0 || venuesLength > 0) {
        setCurrentView("dashboard");
      } else {
        setCurrentView("roleSelection");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching user entities:", error);
      // Check for 401 by status code (more reliable than message)
      const isUnauthorized = error?.status === 401 || (error?.message && typeof error.message === 'string' && error.message.includes("401"));
      if (isUnauthorized) {
        // Unauthorized - clear token and go to login
        localStorage.removeItem("access_token");
        setIsAuthenticated(false);
        setCurrentView("login");
      } else {
        // For network errors or timeouts, check if backend is reachable
        // If we can't reach the backend and have a token, clear it and show login
        if (error?.message?.includes("timeout") || error?.message?.includes("Failed to fetch")) {
          console.warn("Backend appears to be unreachable. Clearing token and showing login.");
          localStorage.removeItem("access_token");
          setIsAuthenticated(false);
          setCurrentView("login");
        } else {
          setCurrentView("roleSelection");
        }
      }
    } finally {
      setIsCheckingEntities(false);
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

  const handleContinueToDashboard = async () => {
    // Refresh user entities to ensure we have the latest data
    await checkUserEntities();
    // checkUserEntities will set the view to dashboard if bands/venues exist
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setIsAuthenticated(false);
    setCurrentView("login");
  };

  const renderView = () => {
    // Show loading state while checking user entities
    if (isCheckingEntities && isAuthenticated) {
      return (
        <div className="app">
          <div className="loading-message">Loading...</div>
        </div>
      );
    }

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
        return (
          <RoleSelection 
            onRoleSelect={handleRoleSelect}
            onBackToLogin={handleLogout}
          />
        );

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
        // If we have bands, show band dashboard
        if (userBands.length > 0) {
          return <BandDashboard bandId={userBands[0].id} onLogout={handleLogout} />;
        }

        // If we have venues, show venue dashboard
        if (userVenues.length > 0) {
          return <VenueDashboard venueId={userVenues[0].id} onLogout={handleLogout} />;
        }

        // No bands or venues - show placeholder to create/join
        return (
          <div className="dashboard-placeholder">
            <h1>Welcome to BackLine</h1>
            <p>Get started by creating or joining a band or venue</p>
            <button onClick={() => setCurrentView("roleSelection")}>Get Started</button>
            <button onClick={handleLogout}>Logout</button>
          </div>
        );

      // DEV MODE: Direct dashboard views
      case "bandDashboard":
        // In dev mode, use first band if available, otherwise show error
        if (userBands.length > 0) {
          return <BandDashboard bandId={userBands[0].id} onLogout={handleLogout} />;
        }
        return (
          <div className="dashboard-placeholder">
            <h1>Dev Mode: No Bands</h1>
            <p>Please create a band first or switch to login view</p>
          </div>
        );

      case "venueDashboard":
        return <VenueDashboard onLogout={handleLogout} />;


      default:
        return <Login onSwitchToSignup={() => setCurrentView("signup")} />;
    }
  };

  return <div className="app">{renderView()}</div>;
};

export default App;

