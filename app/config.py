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

