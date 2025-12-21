# Backend Setup Checklist

Use this checklist to set up your Backline backend. Check off each item as you complete it.

## Prerequisites

- [ ] Python 3.10 or higher installed
- [ ] PostgreSQL 13 or higher installed
- [ ] Node.js and npm installed (for frontend)

## Database Setup

- [ ] PostgreSQL is running
- [ ] Created database: `backline_db`
- [ ] Created user: `backline_user` with password
- [ ] Granted all privileges to user

**Commands:**
```sql
CREATE DATABASE backline_db;
CREATE USER backline_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE backline_db TO backline_user;
```

## Backend Configuration

- [ ] Created `.env` file in project root
- [ ] Set `DATABASE_URL` with correct credentials
- [ ] Generated secure `SECRET_KEY` (32+ characters)
- [ ] Verified `.env` file is NOT committed to git

**Generate SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Python Environment

- [ ] Created virtual environment (`python -m venv venv`)
- [ ] Activated virtual environment (`venv\Scripts\activate`)
- [ ] Installed dependencies (`pip install -r requirements.txt`)
- [ ] All packages installed without errors

## Database Migrations

- [ ] Generated initial migration (`alembic revision --autogenerate -m "Initial"`)
- [ ] Applied migrations (`alembic upgrade head`)
- [ ] No migration errors
- [ ] Database tables created successfully

## Start Services

- [ ] Backend server starts without errors (`uvicorn app.main:app --reload`)
- [ ] Backend accessible at http://localhost:8000
- [ ] API docs accessible at http://localhost:8000/docs
- [ ] Frontend starts without errors (`npm start`)
- [ ] Frontend accessible at http://localhost:3000

## Integration Testing

- [ ] Health check works: http://localhost:8000/
- [ ] API documentation loads: http://localhost:8000/docs
- [ ] Can register new user from frontend
- [ ] Can login with registered user
- [ ] Can create a band
- [ ] Can create a venue
- [ ] No CORS errors in browser console
- [ ] No 404 errors for API endpoints

## Optional Enhancements

- [ ] Added `.env` to `.gitignore` (if not already)
- [ ] Created `.env.example` for team reference
- [ ] Configured IDE/editor for Python virtual environment
- [ ] Set up database backup strategy
- [ ] Reviewed security settings in `.env`

## Troubleshooting Completed

If you encountered issues, mark what you've verified:

- [ ] PostgreSQL service is running
- [ ] Database connection works from psql/pgAdmin
- [ ] Virtual environment is activated (prompt shows `(venv)`)
- [ ] Port 8000 is not in use by another process
- [ ] Port 3000 is not in use by another process
- [ ] `.env` file has no syntax errors
- [ ] DATABASE_URL format is correct
- [ ] All Python packages installed (no import errors)

## Ready for Development!

Once all items are checked, you're ready to start developing!

### Next Steps:
1. Review API endpoints at http://localhost:8000/docs
2. Test all authentication flows
3. Create test data (bands, venues, events)
4. Connect frontend dashboards to real API data
5. Implement additional features

---

**Need Help?**
- Quick start: [QUICK_START.md](QUICK_START.md)
- Detailed setup: [BACKEND_SETUP.md](BACKEND_SETUP.md)
- Main documentation: [README.md](README.md)
