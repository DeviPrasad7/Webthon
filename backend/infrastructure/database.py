import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from backend.config import get_settings

logger = logging.getLogger("jarvis.infra.database")


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        logger.info(
            "\n╔══ DATABASE ▸ ENGINE INIT ════════════════════════════════\n"
            "║  URL       : %s\n"
            "║  Pool      : size=20, overflow=10, recycle=300s\n"
            "╚══════════════════════════════════════════════════════════\n",
            settings.postgres_url.split("@")[-1] if "@" in settings.postgres_url else "(masked)",
        )
        _engine = create_async_engine(
            settings.postgres_url,
            pool_size=20,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=300,
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.debug("  DATABASE ▸ Session factory created")
    return _session_factory


async def get_db_session() -> AsyncSession:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db():
    from backend.infrastructure.postgres_adapter import (  # noqa: F401
        ObjectiveTable, LearningTable, DecisionLogTable, ReflectionTable,
        ChatSessionTable, ChatMessageTable,
    )
    engine = get_engine()
    logger.info("  DATABASE ▸ Running schema migration (create_all)…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("  DATABASE ▸ Schema ready ✓")


async def shutdown_db():
    global _engine
    if _engine:
        logger.info("  DATABASE ▸ Disposing engine…")
        await _engine.dispose()
        _engine = None
        logger.info("  DATABASE ▸ Engine disposed ✓")
