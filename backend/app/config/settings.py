from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env",override=True)
class Settings(BaseSettings):
    GROQ_API_KEY: str
    DATABASE_URL: str
    SECRET_AUTH_KEY: str

    class Config:
        env_file= ".env"
        env_file_encoding= "utf-8"