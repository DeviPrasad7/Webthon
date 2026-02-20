import asyncio
import logging
from typing import List
from backend.domain.models import Learning, LearningCategory
from backend.domain.events import DomainEvent, EventType
from backend.ports.interfaces import (
    LearningRepository,
    VectorStore,
    EmbeddingProvider,
    EventBus,
)

logger = logging.getLogger("jarvis.usecase.learning")


class CaptureLearningUseCase:
    """Capture a learning manually or from AI extraction."""

    def __init__(
        self,
        repo: LearningRepository,
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
        content: str,
        category: str = "insight",
        tags: List[str] = None,
        source_objective_id: str = None,
    ) -> Learning:
        logger.info("[LEARNING] Capturing learning: category=%s, tags=%s", category, tags)

        try:
            cat = LearningCategory(category)
        except ValueError:
            logger.warning("[LEARNING] Invalid category '%s', defaulting to 'insight'.", category)
            cat = LearningCategory.INSIGHT

        learning = Learning(
            content=content,
            category=cat,
            tags=tags or [],
            source_objective_id=source_objective_id,
        )
        logger.info("[LEARNING] Created learning_id=%s", learning.id)

        embedding = await self._embedding.embed(learning.embedding_text())
        payload = learning.model_dump(mode="json")
        payload["_type"] = "learning"

        await asyncio.gather(
            self._repo.save(learning),
            self._vector_store.upsert(learning.id, embedding, payload),
            return_exceptions=True,
        )
        logger.info("[LEARNING] Persisted learning_id=%s to Postgres + VectorStore.", learning.id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.LEARNING_CAPTURED,
                objective_id=source_objective_id or "",
                payload={"learning_id": learning.id},
            ),
        )
        logger.info("[LEARNING] Published LEARNING_CAPTURED event for learning_id=%s\n", learning.id)

        return learning

    async def save_batch(self, learnings: List[Learning]) -> List[Learning]:
        """Save a batch of AI-extracted learnings."""
        logger.info("[LEARNING] Saving batch of %d learnings...", len(learnings))

        saved = []
        for i, learning in enumerate(learnings, 1):
            embedding = await self._embedding.embed(learning.embedding_text())
            payload = learning.model_dump(mode="json")
            payload["_type"] = "learning"
            await asyncio.gather(
                self._repo.save(learning),
                self._vector_store.upsert(learning.id, embedding, payload),
                return_exceptions=True,
            )
            saved.append(learning)
            logger.info("[LEARNING]   Saved %d/%d: learning_id=%s [%s]", i, len(learnings), learning.id, learning.category.value)

        logger.info("[LEARNING] Batch complete: %d learnings saved.\n", len(saved))
        return saved
