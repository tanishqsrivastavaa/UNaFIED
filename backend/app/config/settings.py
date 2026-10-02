from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

# Real environment variables win, so Docker can point at its own database and Redis.
load_dotenv(dotenv_path=".env", override=False)


class Settings(BaseSettings):
    GROQ_API_KEY: str
    DATABASE_URL: str
    SECRET_AUTH_KEY: str
    GEMINI_API_KEY: str
    REDIS_URL: str
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    CORS_ORIGINS: str
    DEBUG: str
    LOG_LEVEL: str | None = None
    # Reminder emails; leave SMTP_HOST unset to turn email off
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
