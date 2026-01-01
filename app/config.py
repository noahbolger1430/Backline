from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """

    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    dev_mode: bool = True  # Set to True to bypass password verification in development
    youtube_api_key: str = ""  # YouTube Data API v3 key for searching songs
    
    # Google Cloud Platform settings
    gcp_project_id: str = ""  # GCP Project ID
    gcp_images_bucket: str = ""  # GCS bucket name for images (e.g., "backline-photos")
    gcp_files_bucket: str = ""  # GCS bucket name for files (optional, defaults to images bucket)
    google_application_credentials: str = ""  # Path to GCP service account JSON key file

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields in .env (like POSTGRES_PASSWORD)


@lru_cache()
def get_settings() -> "Settings":
    """
    Get cached settings instance to avoid reading .env multiple times.
    """
    return Settings()

