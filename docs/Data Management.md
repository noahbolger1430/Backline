# Data Management

This document explains the data management strategy for the Band Scheduling Platform, including the choice of database, migration tooling, and best practices for contributors.

## Table of Contents

1. [Database Choice: PostgreSQL](#database-choice-postgresql)
2. [ORM: SQLAlchemy](#orm-sqlalchemy)
3. [Migration Tool: Alembic](#migration-tool-alembic)
4. [Alternatives Considered](#alternatives-considered)
5. [Alembic Usage in This Project](#alembic-usage-in-this-project)
6. [Migration Workflow](#migration-workflow)
7. [Best Practices for Contributors](#best-practices-for-contributors)

---

## Database Choice: PostgreSQL

This project uses PostgreSQL as its primary database for several reasons:

### Why PostgreSQL?

**Relational Data Model Fit**

The Band Scheduling Platform has a highly relational data structure with complex relationships between entities:
- Users belong to multiple Bands (many-to-many via BandMember)
- Users can be staff at multiple Venues (many-to-many via VenueStaff)
- Bands have Availability entries (one-to-many)
- Venues have Events (one-to-many)
- Events have Applications from Bands (many-to-many via EventApplication)

PostgreSQL excels at maintaining referential integrity across these relationships through foreign key constraints, cascading deletes, and transactional consistency.

**ACID Compliance**

Scheduling applications require strong data consistency guarantees. When a band applies to an event, we need to ensure:
- The band exists
- The event exists
- No duplicate application is created
- All related data remains consistent

PostgreSQL provides full ACID (Atomicity, Consistency, Isolation, Durability) compliance, ensuring data integrity even under concurrent access.

**Advanced Features**

PostgreSQL offers features that benefit this application:
- **Date/Time Support**: Native DATE, TIME, and TIMESTAMP types with timezone awareness for scheduling
- **Indexing**: B-tree indexes on foreign keys and frequently queried columns (dates, status fields)
- **Constraints**: CHECK constraints, UNIQUE constraints, and complex validation rules
- **JSON Support**: JSONB type available if we need flexible schema storage in the future

**Scalability**

PostgreSQL scales well for the expected workload:
- Connection pooling support
- Read replicas for scaling read operations
- Partitioning capabilities for large tables (useful if availability data grows significantly)

**Open Source and Community**

PostgreSQL is open source with an active community, aligning with our goal to eventually open source this application.

---

## ORM: SQLAlchemy

SQLAlchemy serves as the Object-Relational Mapper (ORM) for this project.

### Why SQLAlchemy?

**Python Ecosystem Standard**

SQLAlchemy is the most mature and widely adopted ORM in the Python ecosystem. It provides:
- Comprehensive documentation
- Large community and extensive resources
- Battle-tested in production environments

**Flexibility**

SQLAlchemy offers two usage patterns:
- **ORM Pattern**: High-level, object-oriented database interactions (used in this project)
- **Core Pattern**: Lower-level SQL expression language for complex queries when needed

**Type Safety**

SQLAlchemy 2.0 provides improved type hints and works well with static type checkers like mypy, aligning with our strict typing requirements.

**Database Agnostic**

While we use PostgreSQL, SQLAlchemy abstracts database-specific SQL, making it possible to:
- Run tests against SQLite for speed
- Migrate to a different database if requirements change
- Support multiple database backends in the future

---

## Migration Tool: Alembic

Alembic is the database migration tool for this project. It handles schema versioning and database evolution.

### What is Alembic?

Alembic is a lightweight database migration tool written by the author of SQLAlchemy. It provides:
- Version control for database schemas
- Automatic migration script generation
- Upgrade and downgrade capabilities
- Branch and merge support for parallel development

### Why Alembic?

**Native SQLAlchemy Integration**

Alembic is designed specifically to work with SQLAlchemy. This integration provides:
SQLAlchemy Models <---> Alembic <---> PostgreSQL Database

- **Autogeneration**: Alembic can compare SQLAlchemy models to the current database schema and automatically generate migration scripts
- **Shared Metadata**: Alembic uses SQLAlchemy's MetaData object, ensuring consistency between code and migrations
- **Type Mapping**: Column types defined in SQLAlchemy models translate correctly to database-specific types

**Version Control for Database Schema**

Alembic maintains a linear (or branched) history of database changes:
Initial Schema (001)
↓
Add Users/Bands (002)
↓
Add Availability (003)
↓
Add Venues/Events (004)
↓
Add Venue Availability (005)
↓
Current

Each migration is a Python file containing:
- `upgrade()`: Function to apply the migration
- `downgrade()`: Function to reverse the migration
- Revision identifiers linking migrations together

**Environment Parity**

Alembic ensures all environments (development, staging, production) can reach identical database states:

```bash
# Any environment can upgrade to the latest schema
alembic upgrade head

# Or upgrade to a specific version
alembic upgrade abc123

# Or downgrade if needed
alembic downgrade -1
```

**PostgreSQL-Specific Benefits**

Alembic handles PostgreSQL-specific features correctly:
- Sequences for auto-incrementing IDs
- Schema management
- Index creation with proper syntax
- Constraint naming conventions
- Transactional DDL (migrations run in transactions)

**How Alembic Works**

Migration Tracking

Alembic creates a table called alembic_version in the database:

```sql
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
```

This table stores the current migration version, allowing Alembic to determine which migrations need to be applied.

**Autogeneration Process**

When you run `alembic revision --autogenerate`, Alembic:

1) Connects to the database and reads the current schema  
2) Compares it to the SQLAlchemy models defined in code  
3) Generates a migration script with the differences

Example generated migration:

```python
def upgrade() -> None:
    op.create_table(
        "venue_availabilities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("venue_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_venue_availabilities_date", "venue_availabilities", ["date"])


def downgrade() -> None:
    op.drop_index("ix_venue_availabilities_date")
    op.drop_table("venue_availabilities")
```

---

## Alternatives Considered

Several alternatives to Alembic exist. Here is why they were not chosen:

**Django Migrations**  
What it is: Django's built-in migration system.

Why not chosen:
- Tied to Django framework; this project uses FastAPI
- Would require adopting Django ORM instead of SQLAlchemy
- Less flexibility for non-Django projects

**Flyway**  
What it is: Database migration tool popular in Java ecosystems.

Why not chosen:
- Requires writing raw SQL migrations
- No autogeneration from Python models
- Additional dependency outside Python ecosystem
- Less natural integration with SQLAlchemy

**Liquibase**  
What it is: Database schema change management tool supporting XML, YAML, JSON, and SQL formats.

Why not chosen:
- More complex setup and configuration
- Designed for enterprise Java environments
- No Python model integration
- Overkill for this project's needs

**SQLAlchemy-Migrate**  
What it is: Original migration tool for SQLAlchemy (predecessor to Alembic).

Why not chosen:
- Deprecated in favor of Alembic
- Less actively maintained
- Alembic is the recommended successor by SQLAlchemy's author

**Raw SQL Scripts**  
What it is: Managing migrations as numbered SQL files.

Why not chosen:
- No autogeneration capability
- Manual tracking of applied migrations
- No downgrade support without manual implementation
- Error-prone for complex schema changes
- Database-specific SQL reduces portability

### Comparison Summary

| Feature | Alembic | Django Migrations | Flyway | Raw SQL |
| --- | --- | --- | --- | --- |
| SQLAlchemy Integration | Native | None | None | None |
| Autogeneration | Yes | Yes (Django ORM) | No | No |
| Python-based | Yes | Yes | No | No |
| Downgrade Support | Yes | Yes | Limited | Manual |
| Framework Agnostic | Yes | No | Yes | Yes |
| PostgreSQL Support | Excellent | Good | Good | Native |

---

## Alembic Usage in This Project

### Project Structure

```
band-scheduling-platform/
├── alembic.ini              # Alembic configuration
├── alembic/
│   ├── env.py              # Environment configuration
│   ├── script.py.mako      # Migration template
│   └── versions/           # Migration scripts
│       ├── 001_initial_schema.py
│       ├── 002_add_availability.py
│       ├── 003_add_venues_events.py
│       └── 004_add_venue_availability.py
```

### Configuration

The `alembic.ini` file contains database connection settings (loaded from environment variables) and migration behavior options.

The `alembic/env.py` file:

- Imports all SQLAlchemy models to ensure they're registered
- Configures the database connection
- Sets up the migration context

```python
from app.models import (
    User,
    Band,
    BandMember,
    BandMemberAvailability,
    BandAvailability,
    Venue,
    VenueStaff,
    VenueOperatingHours,
    VenueAvailability,
    Event,
    EventApplication,
)
```

### Entity Relationship Overview

The following models are managed through Alembic migrations:

```
┌─────────────────────────────────────────────────────────────────┐
│                         BAND SIDE                                │
├─────────────────────────────────────────────────────────────────┤
│  User ──────┬──────> BandMember <────── Band                    │
│             │             │               │                      │
│             │             ▼               ▼                      │
│             │    BandMemberAvailability  BandAvailability        │
└─────────────┴───────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        VENUE SIDE                                │
├─────────────────────────────────────────────────────────────────┤
│  User ──────┬──────> VenueStaff <────── Venue                   │
│             │                             │                      │
│             │         ┌───────────────────┼───────────────┐     │
│             │         ▼                   ▼               ▼     │
│             │  VenueOperatingHours  VenueAvailability   Event   │
│             │                                             │     │
│             │                                             ▼     │
│             └────────────────────────> EventApplication <─┘     │
│                                              ▲                   │
│                                              │                   │
│                           Band ──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Workflow

### Creating a New Migration

After modifying SQLAlchemy models:

```bash
# Generate migration automatically
alembic revision --autogenerate -m "Description of changes"

# Review the generated migration in alembic/versions/
# Edit if necessary to handle edge cases

# Apply the migration
alembic upgrade head
```

### Applying Migrations

```bash
# Upgrade to latest version
alembic upgrade head

# Upgrade to specific revision
alembic upgrade <revision_id>

# Upgrade by relative number
alembic upgrade +1
```

### Rolling Back Migrations

```bash
# Downgrade by one migration
alembic downgrade -1

# Downgrade to specific revision
alembic downgrade <revision_id>

# Downgrade to nothing (empty database)
alembic downgrade base
```

### Viewing Migration Status

```bash
# Show current revision
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic history --indicate-current
```

---

## Best Practices for Contributors

### When Adding New Models

- Create the model file in `app/models/`
- Import the model in `app/models/__init__.py`
- Create corresponding schemas in `app/schemas/`
- Generate the migration:

```bash
alembic revision --autogenerate -m "Add ModelName model"
```

- Review the generated migration for correctness
- Test the migration locally:

```bash
alembic upgrade head
alembic downgrade -1
alembic upgrade head
```

### When Modifying Existing Models

- Make changes to the model
- Generate migration:

```bash
alembic revision --autogenerate -m "Add field_name to ModelName"
```

- Review carefully - autogeneration may not catch all changes
- Handle data migration if existing data needs transformation

### Migration Naming Conventions

Use descriptive names that indicate the change:

```bash
# Good
alembic revision --autogenerate -m "Add venue operating hours model"
alembic revision --autogenerate -m "Add index on event_date column"
alembic revision --autogenerate -m "Add cascade delete to band_members"

# Avoid
alembic revision --autogenerate -m "Update models"
alembic revision --autogenerate -m "Fix stuff"
```

### Review Checklist for Migrations

Before committing a migration, verify:

- `upgrade()` function creates/modifies schema correctly
- `downgrade()` function reverses all changes
- Indexes are created for frequently queried columns
- Foreign key constraints have appropriate ondelete behavior
- Column nullability matches model definition
- Default values are set correctly
- Migration can be applied to a fresh database
- Migration can be applied to a database with existing data

### Handling Data Migrations

For migrations that require data transformation:

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import column, table


def upgrade() -> None:
    # Schema change
    op.add_column("users", sa.Column("full_name", sa.String()))

    # Data migration
    users = table(
        "users",
        column("id", sa.Integer),
        column("first_name", sa.String),
        column("last_name", sa.String),
        column("full_name", sa.String),
    )

    connection = op.get_bind()
    connection.execute(users.update().values(full_name=users.c.first_name + " " + users.c.last_name))

    # Remove old columns after data migration
    op.drop_column("users", "first_name")
    op.drop_column("users", "last_name")
```

### Common Pitfalls to Avoid

**Do not edit migrations that have been merged to main**

Once a migration is in the shared repository and others may have applied it, create a new migration to make corrections.

**Do not delete migrations**

Migration history should be preserved. If a migration was wrong, create a corrective migration.

**Always test downgrade**

Ensure `downgrade()` works correctly. Some deployments require rollback capability.

**Be cautious with autogenerate**

Autogeneration may miss:

- Column type changes that are compatible (e.g., VARCHAR(50) to VARCHAR(100))
- Index name changes
- Constraint name changes
- Data-only changes

Always review generated migrations before applying.

---

## Additional Resources

- Alembic Documentation
- SQLAlchemy Documentation
- PostgreSQL Documentation
- FastAPI with SQLAlchemy Guide

---

## Updated Project Structure

```
band-scheduling-platform/
├── docs/
│   └── Data Management.md    # NEW
├── app/
│   └── [existing structure...]
├── alembic/
│   └── [existing structure...]
├── README.md
├── requirements.txt
└── [other files...]
```

## README.md Addition

Add this to the README under a new "Documentation" section:

```markdown
## Documentation

Additional documentation is available in the `docs/` directory:

- [Data Management](docs/Data%20Management.md) - Database, ORM, and migration tooling decisions
```

