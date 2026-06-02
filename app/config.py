"""
app/config.py
─────────────
Pydantic-settings based configuration loaded from .env
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Leave Configuration
    TOTAL_ALLOWED_LEAVES: int = 15

    # OpenWebUI LLM Settings
    OPENWEBUI_BASE_URL: str 
    OPENWEBUI_API_KEY: str 
    OPENWEBUI_MODEL: str 




settings = Settings()
