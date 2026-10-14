"""Centralised service configuration (12-factor)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://handkerchief:handkerchief@localhost:5432/handkerchief"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_expire_minutes: int = 60 * 24
    decision_timeout_ms: int = 2000
    env: str = "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()
