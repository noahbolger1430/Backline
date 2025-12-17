# Band Scheduling Platform

A comprehensive scheduling and coordination platform for bands, venues, and promoters.

## Overview

This platform solves the complex problem of coordinating schedules between band members, finding available venues, and connecting with supporting acts. Built with modern Python technologies and designed for scalability.

## Features (Current Implementation)

### Authentication & User Management
- JWT-based authentication
- User registration and login
- User profile management
- Secure password hashing with bcrypt

### Band Management
- Create and manage bands
- Role-based access control (Owner, Admin, Member)
- Add/remove band members
- Track member instruments and roles
- Band profile information (genre, location, description)

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Authentication**: JWT tokens with python-jose
- **Password Hashing**: bcrypt via passlib
- **Validation**: Pydantic v2
- **Migration**: Alembic

## Project Structure
band-scheduling-platform/
├── app/
│   ├── api/                 # API endpoints
│   │   ├── deps.py         # Shared dependencies
│   │   └── v1/             # API version 1
│   │       ├── auth.py     # Authentication endpoints
│   │       ├── users.py    # User endpoints
│   │       └── bands.py    # Band endpoints
│   ├── core/               # Core functionality
│   │   └── security.py     # Security utilities
│   ├── models/             # SQLAlchemy models
│   │   ├── user.py
│   │   ├── band.py
│   │   └── band_member.py
│   ├── schemas/            # Pydantic schemas
│   │   ├── user.py
│   │   ├── band.py
│   │   └── auth.py
│   ├── utils/              # Utility functions
│   │   └── exceptions.py   # Custom exceptions
│   ├── config.py           # Configuration
│   ├── database.py         # Database setup
│   └── main.py             # Application entry point
└── tests/                  # Test suite

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 14+
- pip or poetry

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd band-scheduling-platform
Create a virtual environment:
bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
Install dependencies:
bash
pip install -r requirements.txt
Create a .env file based on .env.example:
bash
cp .env.example .env
Update the .env file with your database credentials and secret key:
env
DATABASE_URL=postgresql://user:password@localhost:5432/band_scheduler
SECRET_KEY=your-secret-key-here
Create the database:
bash
createdb band_scheduler
Run database migrations:
bash
alembic upgrade head
Running the Application
Development server:

bash
uvicorn app.main:app --reload

The API will be available at http://localhost:8000

Interactive API documentation: http://localhost:8000/docs

API Endpoints
Authentication
POST /api/v1/auth/register - Register a new user
POST /api/v1/auth/login - Login and receive JWT token
Users
GET /api/v1/users/me - Get current user profile
PUT /api/v1/users/me - Update current user profile
Bands
POST /api/v1/bands/ - Create a new band
GET /api/v1/bands/ - List user's bands
GET /api/v1/bands/{band_id} - Get band details
PUT /api/v1/bands/{band_id} - Update band (Admin/Owner)
DELETE /api/v1/bands/{band_id} - Delete band (Owner only)
POST /api/v1/bands/{band_id}/members - Add band member (Admin/Owner)
PUT /api/v1/bands/{band_id}/members/{member_id} - Update member (Admin/Owner)
DELETE /api/v1/bands/{band_id}/members/{member_id} - Remove member (Admin/Owner)

## Code Standards
This project adheres to strict code quality standards:

Type Hints: All functions include complete type annotations
Docstrings: All modules, classes, and functions include descriptive docstrings
No Inline Comments: Code is self-documenting; comments are avoided
Black Formatting: Code is formatted with Black
Limited Nesting: Maximum iteration depth of 2 (unless justified)

