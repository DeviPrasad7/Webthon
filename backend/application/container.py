import logging
from functools import lru_cache
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from backend.config import get_settings
from backend.infrastructure.redis_adapter import RedisStagingCache, RedisEventBus
from backend.infrastructure.input_adapter import FileInputExtractor
from backend.infrastructure.ai_adapter import (
    GroqStructuringAgent, GroqPlanningAgent, GroqReflectionAgent, GroqInsightAgent,
)
from backend.infrastructure.embedding_adapter import LocalEmbeddingProvider
from backend.infrastructure.vector_store import InMemoryVectorStore
from backend.infrastructure.postgres_adapter import (
    PostgresObjectiveRepository,
    PostgresLearningRepository,
    PostgresDecisionLogRepository,
    PostgresReflectionRepository,
    PostgresChatHistoryRepository,
)
from backend.application.ingest_use_case import IngestUseCase
from backend.application.confirm_plan_use_case import ConfirmPlanUseCase
from backend.application.update_progress_use_case import UpdateProgressUseCase
from backend.application.query_use_case import QueryUseCase
from backend.application.learning_use_case import CaptureLearningUseCase
from backend.application.decision_use_case import LogDecisionUseCase
from backend.application.reflection_use_case import ReflectionUseCase
from backend.application.search_use_case import SemanticSearchUseCase
from backend.application.chat_use_case import ChatUseCase
from backend.application.event_worker import EventWorker


logger = logging.getLogger("jarvis.container")

_redis_client: Redis = None


async def get_redis() -> Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        logger.info(
            "\n╔══ CONTAINER ▸ REDIS CONNECT ═════════════════════════════\n"
            "║  URL : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            settings.redis_url,
        )
        _redis_client = Redis.from_url(settings.redis_url, decode_responses=False)
    return _redis_client


async def shutdown_redis():
    global _redis_client
    if _redis_client:
        logger.info("  CONTAINER ▸ Closing Redis connection…")
        await _redis_client.aclose()
        _redis_client = None
        logger.info("  CONTAINER ▸ Redis closed ✓")


@lru_cache()
def _get_extractor():
    return FileInputExtractor()


@lru_cache()
def _get_structuring_agent():
    return GroqStructuringAgent()


@lru_cache()
def _get_planning_agent():
    return GroqPlanningAgent()


@lru_cache()
def _get_reflection_agent():
    return GroqReflectionAgent()


@lru_cache()
def _get_insight_agent():
    return GroqInsightAgent()


@lru_cache()
def _get_embedding():
    return LocalEmbeddingProvider()


@lru_cache()
def _get_vector_store():
    return InMemoryVectorStore()


def _get_cache(redis: Redis) -> RedisStagingCache:
    return RedisStagingCache(redis)


def _get_event_bus(redis: Redis) -> RedisEventBus:
    return RedisEventBus(redis)


# ─── Original use cases ───────────────────────────────────────────
async def get_ingest_use_case() -> IngestUseCase:
    logger.debug("  CONTAINER ▸ Building IngestUseCase")
    redis = await get_redis()
    return IngestUseCase(
        extractor=_get_extractor(),
        structuring_agent=_get_structuring_agent(),
        planning_agent=_get_planning_agent(),
        cache=_get_cache(redis),
        event_bus=_get_event_bus(redis),
    )


async def get_confirm_plan_use_case(session: AsyncSession) -> ConfirmPlanUseCase:
    logger.debug("  CONTAINER ▸ Building ConfirmPlanUseCase")
    redis = await get_redis()
    return ConfirmPlanUseCase(
        cache=_get_cache(redis),
        repo=PostgresObjectiveRepository(session),
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        event_bus=_get_event_bus(redis),
    )


async def get_update_progress_use_case(session: AsyncSession) -> UpdateProgressUseCase:
    logger.debug("  CONTAINER ▸ Building UpdateProgressUseCase")
    redis = await get_redis()
    return UpdateProgressUseCase(
        repo=PostgresObjectiveRepository(session),
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        event_bus=_get_event_bus(redis),
    )


async def get_query_use_case(session: AsyncSession) -> QueryUseCase:
    logger.debug("  CONTAINER ▸ Building QueryUseCase")
    redis = await get_redis()
    return QueryUseCase(
        repo=PostgresObjectiveRepository(session),
        cache=_get_cache(redis),
    )


# ─── JARVIS use cases ─────────────────────────────────────────────
async def get_learning_use_case(session: AsyncSession) -> CaptureLearningUseCase:
    logger.debug("  CONTAINER ▸ Building CaptureLearningUseCase")
    redis = await get_redis()
    return CaptureLearningUseCase(
        repo=PostgresLearningRepository(session),
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        event_bus=_get_event_bus(redis),
    )


async def get_decision_use_case(session: AsyncSession) -> LogDecisionUseCase:
    logger.debug("  CONTAINER ▸ Building LogDecisionUseCase")
    redis = await get_redis()
    return LogDecisionUseCase(
        repo=PostgresDecisionLogRepository(session),
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        event_bus=_get_event_bus(redis),
    )


async def get_reflection_use_case(session: AsyncSession) -> ReflectionUseCase:
    logger.debug("  CONTAINER ▸ Building ReflectionUseCase")
    redis = await get_redis()
    return ReflectionUseCase(
        reflection_agent=_get_reflection_agent(),
        repo=PostgresReflectionRepository(session),
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        event_bus=_get_event_bus(redis),
    )


async def get_search_use_case() -> SemanticSearchUseCase:
    logger.debug("  CONTAINER ▸ Building SemanticSearchUseCase")
    return SemanticSearchUseCase(
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
    )


async def get_chat_use_case() -> ChatUseCase:
    logger.debug("  CONTAINER ▸ Building ChatUseCase (no DB session)")
    return ChatUseCase(
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
    )


async def get_chat_use_case_with_history(session: AsyncSession) -> ChatUseCase:
    logger.debug("  CONTAINER ▸ Building ChatUseCase (with persistent history + auto-capture)")
    return ChatUseCase(
        vector_store=_get_vector_store(),
        embedding=_get_embedding(),
        chat_repo=PostgresChatHistoryRepository(session),
        learning_repo=PostgresLearningRepository(session),
        decision_repo=PostgresDecisionLogRepository(session),
    )


async def get_chat_history_repo(session: AsyncSession) -> PostgresChatHistoryRepository:
    return PostgresChatHistoryRepository(session)


async def get_insight_agent_instance():
    return _get_insight_agent()


async def get_objective_repo(session: AsyncSession) -> PostgresObjectiveRepository:
    return PostgresObjectiveRepository(session)


async def get_learning_repo(session: AsyncSession) -> PostgresLearningRepository:
    return PostgresLearningRepository(session)


async def get_decision_repo(session: AsyncSession) -> PostgresDecisionLogRepository:
    return PostgresDecisionLogRepository(session)


async def get_reflection_repo(session: AsyncSession) -> PostgresReflectionRepository:
    return PostgresReflectionRepository(session)


# ─── Event worker ─────────────────────────────────────────────────
async def create_event_worker() -> EventWorker:
    logger.info("  CONTAINER ▸ Assembling EventWorker")
    redis = await get_redis()
    cache = _get_cache(redis)
    event_bus = _get_event_bus(redis)
    ingest = IngestUseCase(
        extractor=_get_extractor(),
        structuring_agent=_get_structuring_agent(),
        planning_agent=_get_planning_agent(),
        cache=cache,
        event_bus=event_bus,
    )
    return EventWorker(event_bus=event_bus, cache=cache, ingest_use_case=ingest)
