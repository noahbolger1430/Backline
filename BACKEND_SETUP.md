# Backend Setup Guide

## Prerequisites
- Python 3.10 or higher
- PostgreSQL 13 or higher
- pip (Python package manager)

## Step-by-Step Setup Instructions

### 1. Install PostgreSQL (if not already installed)

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- Run the installer and follow the setup wizard
- Remember the password you set for the `postgres` user
- Default port: 5432

**Verify Installation:**
```bash
psql --version
```

### 2. Create PostgreSQL Database

Open PostgreSQL command line (psql) or pgAdmin:

```sql
-- Connect as postgres user
CREATE DATABASE backline_db;
CREATE USER backline_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE backline_db TO backline_user;

-- Grant schema privileges (PostgreSQL 15+)
\c backline_db
GRANT ALL ON SCHEMA public TO backline_user;
```

**Or via command line:**
```bash
# Windows (run in Command Prompt or PowerShell)
psql -U postgres
```

Then run the SQL commands above.

### 3. Create .env File

Create a `.env` file in the project root with your database credentials:

```env
# Database Configuration
DATABASE_URL=postgresql://backline_user:your_secure_password@localhost:5432/backline_db

# Security Configuration - GENERATE A SECURE SECRET KEY!
SECRET_KEY=your-secret-key-here-minimum-32-characters-long
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Generate a secure SECRET_KEY:**

```python
# Run this in Python to generate a secure key
import secrets
print(secrets.token_urlsafe(32))
```

Or use an online generator: https://generate-secret.vercel.app/32

### 4. Create Python Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 5. Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- FastAPI - Web framework
- Uvicorn - ASGI server
- SQLAlchemy - Database ORM
- Alembic - Database migrations
- PostgreSQL driver
- JWT authentication libraries
- And more...

### 6. Initialize Database with Alembic Migrations

First, create an initial migration:

```bash
# Create the first migration
alembic revision --autogenerate -m "Initial database schema"

# Apply migrations to database
alembic upgrade head
```

If you encounter any issues, you can also let the app create tables automatically (already configured in `main.py`).

### 7. Start the Backend Server

```bash
# Start with hot-reload for development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or without reload for production-like testing
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API Base URL:** http://localhost:8000
- **API Documentation (Swagger):** http://localhost:8000/docs
- **Alternative Docs (ReDoc):** http://localhost:8000/redoc

### 8. Verify Backend is Running

Open your browser and go to:
- http://localhost:8000/ - Should show: `{"status": "ok", "message": "Band Scheduling Platform API"}`
- http://localhost:8000/docs - Interactive API documentation

### 9. Update Frontend Configuration

In your frontend code, update the API base URL. Create or update `src/config.js`:

```javascript
// src/config.js
export const API_BASE_URL = 'http://localhost:8000/api/v1';
```

Then update your service files to use this constant:

```javascript
import { API_BASE_URL } from '../config';

// Use API_BASE_URL instead of hardcoded URLs
const response = await fetch(`${API_BASE_URL}/auth/login`, { ... });
```

### 10. Test the Integration

1. **Test Health Check:**
   ```bash
   curl http://localhost:8000/
   ```

2. **Test User Registration:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123","full_name":"Test User"}'
   ```

3. **Test Login:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test@example.com","password":"testpass123"}'
   ```

4. **Test from Frontend:**
   - Start your frontend (`npm start`)
   - Try signing up and logging in
   - Check browser console for any CORS or API errors

## Available API Endpoints

Once running, visit http://localhost:8000/docs to see all available endpoints:

- **Authentication:** `/api/v1/auth/register`, `/api/v1/auth/login`
- **Users:** `/api/v1/users/me`
- **Bands:** `/api/v1/bands/` - Create, list, join bands
- **Venues:** `/api/v1/venues/` - Create, list, manage venues
- **Events:** `/api/v1/events/` - Create and manage events
- **Availability:** `/api/v1/availability/` - Manage member availability
- **Applications:** `/api/v1/applications/` - Band event applications

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in .env is correct
- Ensure database user has proper permissions

### Migration Issues
```bash
# Reset migrations (WARNING: Drops all tables)
alembic downgrade base
alembic upgrade head
```

### Port Already in Use
```bash
# Kill process on port 8000 (Windows)
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or use a different port
uvicorn app.main:app --reload --port 8001
```

### Import Errors
- Make sure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.10+)

### CORS Issues
- Backend is configured to allow all origins (development only)
- Check browser console for specific CORS errors
- Ensure frontend is making requests to correct URL

## Development Workflow

1. **Keep backend running:** `uvicorn app.main:app --reload`
2. **Keep frontend running:** `npm start`
3. **Backend changes:** Auto-reload is enabled with `--reload` flag
4. **Database changes:** 
   - Modify models in `app/models/`
   - Generate migration: `alembic revision --autogenerate -m "description"`
   - Apply migration: `alembic upgrade head`

## Production Considerations

For production deployment, you'll need to:
- Use proper SECRET_KEY (not in version control)
- Configure proper CORS origins (not allow_origins=["*"])
- Use environment variables for configuration
- Set up proper database backups
- Use a production ASGI server configuration
- Add rate limiting and security headers
- Set up SSL/TLS certificates

## Next Steps

1. Test all authentication flows
2. Create test bands and venues
3. Test availability setting
4. Test event creation and applications
5. Integrate real data in frontend dashboards
