from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://ai:ai@localhost:5433/knowledge_app"
    )

    # API Keys
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    nvidia_api_key: str = os.getenv("NVIDIA_API_KEY", "")

    # Server
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = os.getenv("PORT", 8000)
    debug: bool = os.getenv("DEBUG", True)

    # Agno Settings
    default_model: str = os.getenv("DEFAULT_MODEL", "llama-3.3-70b-versatile")
    default_temperature: float = os.getenv("DEFAULT_TEMPERATURE", 0.7)
    default_max_tokens: int = os.getenv("DEFAULT_MAX_TOKENS", 2048)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
