from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env",override=True)
class Settings(BaseSettings):
    GROQ_API_KEY: str
    DATABASE_URL: str
    SECRET_AUTH_KEY: str
    OPENAI_API_KEY: str
    REDIS_URL: str
    GOOGLE_CLIENT_ID: str | None = None

    class Config:
        env_file= ".env"
        env_file_encoding= "utf-8"

settings=Settings()

