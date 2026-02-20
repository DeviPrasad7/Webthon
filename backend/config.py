from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    groq_api_key: str
    postgres_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/webthon"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    redis_url: str = "redis://localhost:6379/0"
    stream_group: str = "objective_workers"
    staging_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
