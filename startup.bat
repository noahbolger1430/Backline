@echo off
REM Backline Development Startup Script
REM Starts both backend and frontend servers for local development

REM Change to the directory where this script is located (project root)
cd /d "%~dp0"

echo ==========================================
echo Starting Backline Development Servers
echo ==========================================
echo Current directory: %CD%
echo.

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please create a .env file with your database credentials.
    echo.
)

REM Check if virtual environment exists
if not exist "venv\" (
    echo Virtual environment not found. Creating one...
    python -m venv venv
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate

REM Check if node_modules exists
if not exist "node_modules\" (
    echo node_modules not found. Installing dependencies...
    call npm install
    echo.
)

REM Start backend server in a new window
echo Starting backend server on http://localhost:8000
echo API Documentation: http://localhost:8000/docs
start "Backline Backend" cmd /k "venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a moment for backend to start
timeout /t 2 /nobreak >nul

REM Start frontend server in a new window
echo Starting frontend server on http://localhost:3000
start "Backline Frontend" cmd /k "npm start"

echo.
echo ==========================================
echo Both servers are starting!
echo ==========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause

