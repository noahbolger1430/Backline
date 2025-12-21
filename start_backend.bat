@echo off
REM Quick start script for Backline backend
REM Make sure you've completed setup steps first (see BACKEND_SETUP.md)

REM Change to the directory where this script is located (project root)
cd /d "%~dp0"

echo Starting Backline Backend...
echo Current directory: %CD%
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo Virtual environment not found. Creating one...
    python -m venv venv
    echo.
)

REM Activate virtual environment
call venv\Scripts\activate

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please create a .env file with your database credentials.
    echo See BACKEND_SETUP.md for instructions.
    pause
    exit /b 1
)

REM Start the server
echo Starting FastAPI server on http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
