import asyncio
import logging
from typing import List
from backend.domain.models import DecisionLog
from backend.domain.events import DomainEvent, EventType
from backend.ports.interfaces import (
    DecisionLogRepository,
    VectorStore,
    EmbeddingProvider,
    EventBus,
)

logger = logging.getLogger("jarvis.usecase.decision")


class LogDecisionUseCase:
    """Log a business decision with its reasoning."""

    def __init__(
        self,
        repo: DecisionLogRepository,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
        event_bus: EventBus,
    ):
        self._repo = repo
        self._vector_store = vector_store
        self._embedding = embedding
        self._event_bus = event_bus

    async def execute(
        self,
        decision: str,
        why: str,
        context: str,
        alternatives_considered: List[str] = None,
        expected_outcome: str = "",
        tags: List[str] = None,
        source_objective_id: str = None,
    ) -> DecisionLog:
        logger.info("[DECISION] Logging decision: '%s'", decision[:80])
        logger.info("[DECISION]   Why: '%s'", why[:80])
        logger.info("[DECISION]   Alternatives: %s", alternatives_considered or [])

        log = DecisionLog(
            decision=decision,
            why=why,
            context=context,
            alternatives_considered=alternatives_considered or [],
            expected_outcome=expected_outcome,
            tags=tags or [],
            source_objective_id=source_objective_id,
        )
        logger.info("[DECISION] Created decision_id=%s", log.id)

        embedding = await self._embedding.embed(log.embedding_text())
        payload = log.model_dump(mode="json")
        payload["_type"] = "decision"

        await asyncio.gather(
            self._repo.save(log),
            self._vector_store.upsert(log.id, embedding, payload),
            return_exceptions=True,
        )
        logger.info("[DECISION] Persisted decision_id=%s to Postgres + VectorStore.", log.id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.DECISION_LOGGED,
                objective_id=source_objective_id or "",
                payload={"decision_id": log.id},
            ),
        )
        logger.info("[DECISION] Published DECISION_LOGGED event for decision_id=%s\n", log.id)

        return log
