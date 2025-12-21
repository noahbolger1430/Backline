"""Script to ensure the database exists before running migrations."""
import sys
import os
from urllib.parse import urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load .env file FIRST before importing Settings to avoid validation errors
load_dotenv()

def ensure_database():
    """Check if database exists and create it if it doesn't."""
    try:
        # Read DATABASE_URL directly from environment to avoid Settings validation issues
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("ERROR: DATABASE_URL not found in .env file")
            return False
        
        # Parse the database URL
        parsed = urlparse(database_url)
        db_name = parsed.path.lstrip('/')
        db_user = parsed.username
        db_password = parsed.password
        db_host = parsed.hostname or 'localhost'
        db_port = parsed.port or 5432
        
        print(f"Checking database '{db_name}'...")
        
        # Try connecting with the specified user first
        try:
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                database='postgres'
            )
        except psycopg2.OperationalError:
            # If that fails, try connecting as postgres superuser
            print(f"Could not connect as '{db_user}'. Trying as 'postgres' superuser...")
            postgres_password = os.getenv('POSTGRES_PASSWORD', '')
            if not postgres_password:
                print("ERROR: Could not connect to PostgreSQL.")
                print("Please either:")
                print("  1. Create the user in PostgreSQL, OR")
                print("  2. Add POSTGRES_PASSWORD to your .env file to use postgres superuser")
                print()
                print("To create the user, run in psql:")
                print(f"  CREATE USER {db_user} WITH PASSWORD 'your_password';")
                print()
                print("Or add to .env file:")
                print("  POSTGRES_PASSWORD=your_postgres_password")
                return False
            
            try:
                conn = psycopg2.connect(
                    host=db_host,
                    port=db_port,
                    user='postgres',
                    password=postgres_password,
                    database='postgres'
                )
            except psycopg2.OperationalError as e:
                print(f"ERROR: Could not connect to PostgreSQL as postgres user")
                print(f"Details: {e}")
                return False
        
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_name,)
        )
        exists = cursor.fetchone()
        
        if exists:
            print(f"[OK] Database '{db_name}' already exists.")
        else:
            print(f"Creating database '{db_name}'...")
            cursor.execute(f'CREATE DATABASE "{db_name}"')
            print(f"[OK] Database '{db_name}' created successfully.")
            
            # Grant privileges (in case the user needs them)
            try:
                cursor.execute(f'GRANT ALL PRIVILEGES ON DATABASE "{db_name}" TO "{db_user}"')
                print(f"[OK] Privileges granted to user '{db_user}'.")
            except Exception as e:
                print(f"[WARNING] Could not grant privileges: {e}")
                print("You may need to grant privileges manually.")
        
        cursor.close()
        conn.close()
        return True
        
    except psycopg2.OperationalError as e:
        print(f"ERROR: Could not connect to PostgreSQL")
        print(f"Details: {e}")
        print()
        print("Please check:")
        print("  1. PostgreSQL service is running")
        print("  2. Database user and password in .env are correct")
        print("  3. Host and port in DATABASE_URL are correct")
        print()
        print("If the user doesn't exist, create it with:")
        print(f"  CREATE USER {db_user} WITH PASSWORD 'your_password';")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    success = ensure_database()
    sys.exit(0 if success else 1)
