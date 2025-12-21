@echo off
REM Backend setup script for Backline
echo Backline Backend Setup Script
echo =============================
echo.

REM Create virtual environment
if not exist "venv\" (
    echo Step 1: Creating virtual environment...
    python -m venv venv
    echo Virtual environment created!
    echo.
) else (
    echo Virtual environment already exists.
    echo.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate

REM Install dependencies
echo Step 2: Installing Python dependencies...
pip install -r requirements.txt
echo.

REM Check for .env file
if not exist ".env" (
    echo Step 3: Creating .env template...
    echo WARNING: You need to edit .env with your actual credentials!
    echo.
    (
        echo # Database Configuration
        echo DATABASE_URL=postgresql://backline_user:your_password@localhost:5432/backline_db
        echo.
        echo # Security Configuration
        echo SECRET_KEY=CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_MINIMUM_32_CHARS
        echo ALGORITHM=HS256
        echo ACCESS_TOKEN_EXPIRE_MINUTES=30
    ) > .env
    echo .env file created! Please edit it with your actual values.
    echo.
) else (
    echo .env file already exists.
    echo.
)

echo Step 4: Ensuring database exists...
python ensure_database.py
if errorlevel 1 (
    echo.
    echo ERROR: Failed to ensure database exists.
    echo Please check your PostgreSQL connection settings in .env
    pause
    exit /b 1
)
echo.

echo Step 5: Running database migrations...
python -m alembic upgrade head
if errorlevel 1 (
    echo.
    echo ERROR: Failed to apply migrations.
    echo Please check your database connection and try again.
    pause
    exit /b 1
)
echo.

echo =============================
echo Setup complete!
echo.
echo Next steps:
echo 1. Make sure PostgreSQL is running
echo 2. Edit .env with your actual database credentials
echo 3. Run: start_backend.bat
echo.
echo See BACKEND_SETUP.md for detailed instructions.
pause
