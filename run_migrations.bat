@echo off
REM Script to run Alembic migrations for Backline
echo Running Alembic migrations...
echo.

REM Activate virtual environment
call venv\Scripts\activate

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo Please create a .env file with your database credentials.
    pause
    exit /b 1
)

REM Ensure database exists
echo Step 0: Ensuring database exists...
python ensure_database.py
if errorlevel 1 (
    echo.
    echo ERROR: Failed to ensure database exists.
    echo Please check your PostgreSQL connection settings in .env
    pause
    exit /b 1
)
echo.

REM Generate initial migration if it doesn't exist
echo Step 1: Checking for existing migrations...
if not exist "alembic\versions\*.py" (
    echo No migrations found. Creating initial migration...
    python -m alembic revision --autogenerate -m "Initial database schema"
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to create migration.
        echo Make sure PostgreSQL is running and the database exists.
        pause
        exit /b 1
    )
    echo Initial migration created successfully!
    echo.
) else (
    echo Migrations found.
    echo.
)

REM Apply migrations
echo Step 2: Applying migrations to database...
python -m alembic upgrade head
if errorlevel 1 (
    echo.
    echo ERROR: Failed to apply migrations.
    echo Please check:
    echo   1. PostgreSQL service is running
    echo   2. Database 'backline_db' exists
    echo   3. User 'backline_user' has proper permissions
    echo   4. DATABASE_URL in .env is correct
    pause
    exit /b 1
)

echo.
echo =============================
echo Migrations completed successfully!
echo.
echo Database tables have been created.
echo You can now start the backend server with: start_backend.bat
echo.
pause
