"""Quick script to test database connection."""
import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

database_url = os.getenv('DATABASE_URL')
if not database_url:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

try:
    print(f"Attempting to connect to database...")
    print(f"URL: {database_url.split('@')[1] if '@' in database_url else 'hidden'}")
    
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print("SUCCESS: Successfully connected to PostgreSQL!")
    print(f"  Version: {version[0]}")
    
    # Test query
    cursor.execute("SELECT current_database(), current_user;")
    db_info = cursor.fetchone()
    print(f"  Database: {db_info[0]}")
    print(f"  User: {db_info[1]}")
    
    cursor.close()
    conn.close()
    print("\nSUCCESS: Database connection test PASSED")
except psycopg2.OperationalError as e:
    print(f"\nERROR: Database connection FAILED")
    print(f"  Error: {e}")
    print("\nPossible issues:")
    print("  1. PostgreSQL service is not running")
    print("  2. Database credentials in .env are incorrect")
    print("  3. Database or user doesn't exist")
    print("\nTo start PostgreSQL on Windows:")
    print("  - Open Services (Win+R, type 'services.msc')")
    print("  - Find 'postgresql' service and start it")
except Exception as e:
    print(f"\nERROR: Unexpected error: {e}")
