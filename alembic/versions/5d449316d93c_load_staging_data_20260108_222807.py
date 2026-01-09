"""load_staging_data

Revision ID: 5d449316d93c
Revises: 21baaf6ce640
Create Date: 2026-01-08 22:28:07.848120

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d449316d93c'
down_revision: Union[str, Sequence[str], None] = '21baaf6ce640'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Load staging data into the database."""
    # Read and execute the SQL file
    import os
    from pathlib import Path
    
    # Get the path to the SQL file
    # Try multiple locations: same dir as migration, project root, alembic dir
    migration_dir = Path(__file__).parent
    project_root = migration_dir.parent.parent
    alembic_dir = migration_dir.parent
    
    sql_file = None
    for base_path in [project_root, alembic_dir, migration_dir]:
        candidate = base_path / 'staging_data.sql'
        if candidate.exists():
            sql_file = candidate
            break
    
    if sql_file is None:
        # Try with just the filename in project root
        sql_file = project_root / 'staging_data.sql'
    
    if not sql_file.exists():
        raise FileNotFoundError(
            f"SQL data file not found. Expected at: {sql_file}\n"
            f"Please ensure the file exists and is accessible."
        )
    
    # Read SQL file
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_statements = f.read()
    
    # Split by semicolon and execute each statement
    # Filter out empty statements and comments
    statements = [
        stmt.strip() 
        for stmt in sql_statements.split(';') 
        if stmt.strip() and not stmt.strip().startswith('--')
    ]
    
    # Execute statements
    connection = op.get_bind()
    executed = 0
    errors = 0
    
    for statement in statements:
        if statement:
            try:
                connection.execute(sa.text(statement))
                executed += 1
            except Exception as e:
                # Log but continue - some statements might fail if data already exists
                errors += 1
                # Only log first few errors to avoid spam
                if errors <= 5:
                    import logging
                    logging.warning(f"Failed to execute statement: {str(e)[:100]}")
    
    connection.commit()


def downgrade() -> None:
    """Remove staging data from the database."""
    # For data migrations, downgrade typically means clearing the data
    # You may want to customize this based on your needs
    connection = op.get_bind()
    
    # List of tables to clear (in reverse dependency order)
    # You may need to adjust this based on your schema
    tables = [
        'physical_ticket_sales',
        'physical_ticket_allocations',
        'physical_ticket_pools',
        'gig_engagements',
        'gig_views',
        'genre_tags',
        'rehearsal_attachments',
        'rehearsals',
        'setlist_songs',
        'setlists',
        'event_applications',
        'band_events',
        'events',
        'venue_favorites',
        'venue_equipment',
        'venues',
        'band_members',
        'bands',
        'users',
    ]
    
    # Disable foreign key checks temporarily (PostgreSQL specific)
    for table in tables:
        try:
            connection.execute(sa.text(f'TRUNCATE TABLE {table} CASCADE;'))
        except Exception:
            # Table might not exist or might be empty
            pass
    
    connection.commit()
