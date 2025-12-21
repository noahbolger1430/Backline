# Backline - Quick Start Guide

## Backend Setup (First Time Only)

### 1. Install PostgreSQL
Download and install: https://www.postgresql.org/download/windows/

### 2. Create Database
```sql
-- Open psql or pgAdmin and run:
CREATE DATABASE backline_db;
CREATE USER backline_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE backline_db TO backline_user;
```

### 3. Run Setup Script (Windows)
```bash
setup_backend.bat
```

This will:
- Create Python virtual environment
- Install all dependencies
- Create .env template
- Run database migrations

### 4. Edit .env File
Open `.env` and update:
```env
DATABASE_URL=postgresql://backline_user:your_password@localhost:5432/backline_db
SECRET_KEY=your-32-char-secure-random-string-here
```

**Generate SECRET_KEY:**
```python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Running the Application

### Start Backend
```bash
# Option 1: Use the script
start_backend.bat

# Option 2: Manual
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at:
- **API:** http://localhost:8000
- **Docs:** http://localhost:8000/docs

### Start Frontend
```bash
npm start
```

Frontend will be available at:
- **App:** http://localhost:3000

---

## Quick Test

### 1. Check Backend Health
Open: http://localhost:8000/
Should see: `{"status": "ok", "message": "Band Scheduling Platform API"}`

### 2. View API Docs
Open: http://localhost:8000/docs
Interactive Swagger documentation with all endpoints

### 3. Test Registration
In your frontend:
1. Click "Sign Up"
2. Enter email, name, password
3. Create account
4. Login with credentials

---

## Development Workflow

### Backend (Terminal 1)
```bash
venv\Scripts\activate
uvicorn app.main:app --reload
```
Auto-reloads on code changes

### Frontend (Terminal 2)
```bash
npm start
```
Auto-reloads on code changes

### Database Changes
```bash
# After modifying models
alembic revision --autogenerate -m "description"
alembic upgrade head
```

---

## Quick Commands Reference

### Backend
```bash
# Activate environment
venv\Scripts\activate

# Start server
uvicorn app.main:app --reload

# Create migration
alembic revision --autogenerate -m "message"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm start

# Build for production
npm run build
```

### Database
```bash
# Connect to database
psql -U backline_user -d backline_db

# Check if PostgreSQL is running
pg_isready
```

---

## Common Issues

### Port 8000 Already in Use
```bash
# Find process
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or use different port
uvicorn app.main:app --reload --port 8001
```

### Database Connection Failed
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Test connection: `psql -U backline_user -d backline_db`

### Module Not Found
```bash
# Reinstall dependencies
venv\Scripts\activate
pip install -r requirements.txt
```

### CORS Errors in Browser
- Backend CORS is configured for development
- Check API URL in frontend services (should be http://localhost:8000/api/v1)
- Clear browser cache and reload

---

## API Endpoints Overview

All endpoints are prefixed with `/api/v1`:

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get token

### Users
- `GET /api/v1/users/me` - Get current user info

### Bands
- `GET /api/v1/bands/` - List user's bands
- `POST /api/v1/bands/` - Create new band
- `POST /api/v1/bands/join` - Join band with invite code
- `GET /api/v1/bands/{id}` - Get band details

### Venues
- `GET /api/v1/venues/my-venues` - List user's venues
- `POST /api/v1/venues/` - Create new venue
- `POST /api/v1/venues/join` - Join venue with invite code
- `GET /api/v1/venues/{id}` - Get venue details

### Events
- `GET /api/v1/events/` - List events
- `POST /api/v1/events/` - Create event
- `GET /api/v1/events/{id}` - Get event details

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/backline_db
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env.local)
```env
REACT_APP_API_URL=http://localhost:8000/api/v1
```

---

## File Structure

```
Backline/
├── app/                    # Backend code
│   ├── api/v1/            # API endpoints
│   ├── models/            # Database models
│   ├── schemas/           # Pydantic schemas
│   ├── services/          # Business logic
│   └── main.py            # FastAPI app
├── src/                   # Frontend code
│   ├── components/        # React components
│   └── services/          # API services
├── alembic/              # Database migrations
├── requirements.txt      # Python dependencies
├── package.json          # Node dependencies
└── .env                  # Backend config (create this)
```

---

## Next Steps

1. ✅ Set up backend (this guide)
2. ✅ Start both servers
3. 🔄 Test user registration and login
4. 🔄 Create test band and venue
5. 🔄 Test all features in UI
6. 📝 Add real data to dashboards
7. 🎨 Refine UI/UX based on testing

For detailed setup instructions, see **BACKEND_SETUP.md**
