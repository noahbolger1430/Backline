BackLine Frontend - Developer Documentation

📋 Table of Contents
Overview
Tech Stack
Project Structure
Setup & Installation
Running the Application
Application Architecture
User Workflows
Component Documentation
API Integration
Development Guidelines

Overview
BackLine is a web application that facilitates show scheduling and coordination between bands and venues. The platform allows bands to manage their availability and bookings, while venues can schedule events and manage their staff. The frontend is built as a single-page application (SPA) using React.

Key Features
- User authentication with JWT tokens
- Band creation and member management
- Venue creation and staff management
- Invite code system for joining bands/venues
- Interactive calendars for availability management
- Event scheduling and visualization

Tech Stack
Frontend Technologies
- React 18.x - UI library for building component-based interfaces
- JavaScript (ES6+) - Primary programming language
- CSS3 - Styling with custom CSS (no framework dependencies)
- React Hooks - State management using useState, useEffect
- Fetch API - HTTP client for backend communication

Backend Integration
- FastAPI - Python backend framework
- PostgreSQL - Primary database
- SQLAlchemy - ORM for database operations
- JWT - Authentication tokens
- RESTful APIs - Communication protocol

Development Tools
- Node.js (v16+ recommended)
- npm - Package management
- Create React App - Build tooling and development server

Project Structure
backline-frontend/
- src/
  - components/
    - Auth/
      - Login.jsx              # Login form component
      - Signup.jsx             # User registration form
      - Auth.css               # Authentication styles
    - Onboarding/
      - RoleSelection.jsx      # Band vs Venue selection
      - BandCreation.jsx       # New band creation form
      - InviteCodeEntry.jsx    # Join band with invite code
      - InviteSuccess.jsx      # Band creation success screen
      - VenueCreation.jsx      # New venue creation form
      - VenueInviteEntry.jsx   # Join venue with invite code
      - VenueSuccess.jsx       # Venue creation success screen
      - Onboarding.css         # Onboarding styles
    - Dashboard/
      - BandDashboard.jsx      # Band member dashboard
      - VenueDashboard.jsx     # Venue staff dashboard
      - Calendar.jsx           # Band availability calendar
      - VenueCalendar.jsx      # Venue events calendar
      - EventsCarousel.jsx     # Band events carousel
      - EventModal.jsx         # Event details modal
      - Sidebar.jsx            # Navigation sidebar
      - Dashboard.css          # Dashboard styles
  - services/
    - authService.js           # Authentication API calls
    - bandService.js           # Band-related API calls
    - venueService.js          # Venue-related API calls
  - App.jsx                    # Main application component
  - App.css                    # Global application styles
  - index.jsx                  # Application entry point
- public/
  - index.html                 # HTML template
- package.json                 # Dependencies and scripts
- .env.example                 # Environment variables template
- README.md                    # This file

Setup & Installation
Prerequisites
- Node.js (v16 or higher)
  - `node --version`  # Should output v16.x.x or higher
- npm (comes with Node.js)
  - `npm --version`   # Should output 8.x.x or higher
- Backend API running locally or accessible remotely
  - FastAPI backend should be running on http://localhost:8000
  - PostgreSQL database should be configured and running

Installation Steps
1) Clone the repository
   - `git clone <repository-url>`
   - `cd backline-frontend`
2) Install dependencies
   - `npm install`
3) Configure environment variables
   - `cp .env.example .env`
   - Edit `.env` file:
     - `REACT_APP_API_URL=http://localhost:8000`
4) Verify backend connectivity
   - Ensure FastAPI backend is running: `uvicorn app.main:app --reload`

Running the Application
- Development Mode
  - `npm start`
  - Opens http://localhost:3000 in your browser
  - Hot reloading enabled; warnings/errors in console
- Production Build
  - `npm run build`
  - Creates optimized production build in `build/`
- Running Tests
  - `npm test`
  - Runs test suite in watch mode; press `a` to run all tests

Application Architecture
State Management
- React local state via hooks
- Auth token stored in localStorage (JWT)
- Top-down props and callbacks

Service Layer
- Services handle API calls (authService, bandService, venueService)

Routing Strategy
- Conditional rendering in `App.jsx`
- No external router yet (can add later)

User Workflows
Authentication Flow
- New user: Signup → Login → Role selection
- Login calls POST /auth/login, stores JWT, then routes to dashboard

Band Member Workflow
- Create band: Login → RoleSelection (Band, no code) → BandCreation form
  - Fields: name, genre, location, description, instrument (optional)
  - Creates band as OWNER, generates invite code, shows success with copy/share
- Join band: Login → RoleSelection (Band, has code) → InviteCodeEntry
  - Enter invite code (+ optional instrument), added as MEMBER, go to BandDashboard
- BandDashboard: header, member pills, availability calendar, events carousel, sidebar

Venue Staff Workflow
- Create venue: Login → RoleSelection (Venue, no code) → VenueCreation form
  - Fields: name, description, street, city, state, zip, capacity, age restriction, sound, parking
  - Creates venue as OWNER, generates invite code, shows success with copy/share
- Join venue: Login → RoleSelection (Venue, has code) → VenueInviteEntry
  - Enter invite code, added as STAFF, go to VenueDashboard
- VenueDashboard: header, staff pills, full-page calendar with events, event modal, sidebar

Component Documentation
Authentication
- Login: `<Login onSwitchToSignup={() => ...} onLoginSuccess={...} />`
- Signup: `<Signup onSwitchToLogin={() => ...} onSignupSuccess={...} />`

Onboarding
- RoleSelection: `<RoleSelection onRoleSelect={(role, hasInviteCode) => {...}} />`
- BandCreation / VenueCreation: forms with validation, loading/error handling
- InviteCodeEntry / VenueInviteEntry: join flows via invite code
- InviteSuccess / VenueSuccess: success screens with code copy/link

Dashboards
- BandDashboard: static data placeholder; calendar + events carousel
- VenueDashboard: event calendar + modal; staff pills

API Integration (current frontend expectations)
- Auth: POST /auth/login, POST /users, GET/PUT /users/me
- Bands: POST /bands, GET /bands, GET /bands/{id}, PUT /bands/{id}, DELETE /bands/{id}, POST /bands/join, POST /bands/{id}/members
- Venues: POST /venues, GET /venues/my-venues, GET /venues/{id}, PATCH /venues/{id}, DELETE /venues/{id}, POST /venues/join, POST /venues/{id}/staff

Development Guidelines
Code Style
- Functional components with hooks; arrow functions; destructured props; single-purpose components

State Management Best Practices
- Descriptive state names; handle loading/error/loaded states

API Error Handling
- Check `response.ok`, surface `error.detail`, catch and set error state

Component Organization
- One component per file; co-locate styles; shared utils in `/utils`; reusable UI in `/components/common`

Testing Approach
- Unit tests for utils; integration for services; component tests for key flows; E2E for end-to-end

Performance Considerations
- Lazy load large components; memoize expensive work; use React.memo; proper keys

Environment Variables
- `.env`:
  - `REACT_APP_API_URL=http://localhost:8000`
  - `REACT_APP_ENABLE_DEBUG=false`
  - `REACT_APP_ENVIRONMENT=development`

Troubleshooting
- CORS: ensure backend CORS; verify API URL
- Auth failures: ensure JWT in headers; check expiry
- Build failures: reinstall deps, clear build cache
- API connection: confirm backend port, network tab, DB connectivity

Future Enhancements
- Real-time calendar sync, event booking, messaging, document management, payments, mobile UX, notifications, advanced search/filter
- Technical: add React Router; Redux/Context; more tests; error boundaries; skeletons; form validation library; TypeScript

Contributing
- Feature branches; follow patterns; add/update tests; update docs; PR with clear description

Support
- Check issues; review API docs; contact team lead

Last Updated: January 2024
Version: 1.0.0

