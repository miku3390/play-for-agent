"""Async SQLAlchemy engine factory. Schema migrations land with Alembic (TODO week 2)."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from .config import get_settings


def make_engine(url: str | None = None) -> AsyncEngine:
    return create_async_engine(url or get_settings().database_url, pool_size=10, max_overflow=20)
