import logging
from backend.domain.models import Reflection
from backend.ports.interfaces import (
    ReflectionAgent,
    ReflectionRepository,
    VectorStore,
    EmbeddingProvider,
    EventBus,
)
from backend.domain.events import DomainEvent, EventType

logger = logging.getLogger("jarvis.usecase.reflection")


class ReflectionUseCase:
    """Generate a reflection based on user trigger + vector-recalled context."""

    def __init__(
        self,
        reflection_agent: ReflectionAgent,
        repo: ReflectionRepository,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
        event_bus: EventBus,
    ):
        self._agent = reflection_agent
        self._repo = repo
        self._vector_store = vector_store
        self._embedding = embedding
        self._event_bus = event_bus

    async def execute(self, trigger: str) -> Reflection:
        logger.info("[REFLECT] Trigger: '%s'", trigger[:100])

        # Semantic search for related context
        logger.info("[REFLECT] Searching vector store for related context...")
        query_embedding = await self._embedding.embed(trigger)
        results = await self._vector_store.search(query_embedding, limit=10)
        logger.info("[REFLECT] Found %d related items.", len(results))

        # Separate by type
        related_objectives = []
        related_learnings = []
        related_decisions = []

        for r in results:
            payload = r.get("payload", {})
            item_type = payload.get("_type", "objective")
            if item_type == "learning":
                related_learnings.append(payload)
            elif item_type == "decision":
                related_decisions.append(payload)
            else:
                related_objectives.append(payload)

        logger.info(
            "[REFLECT] Context breakdown: %d objectives, %d learnings, %d decisions",
            len(related_objectives),
            len(related_learnings),
            len(related_decisions),
        )

        # AI reflection
        logger.info("[REFLECT] Calling AI reflection agent...")
        reflection = await self._agent.reflect(
            trigger=trigger,
            related_objectives=related_objectives,
            related_learnings=related_learnings,
            related_decisions=related_decisions,
        )
        logger.info("[REFLECT] Reflection generated: reflection_id=%s", reflection.id)
        logger.info("[REFLECT]   Patterns found: %d", len(reflection.patterns_identified))
        logger.info("[REFLECT]   Suggestions:    %d", len(reflection.suggestions))

        # Persist reflection
        await self._repo.save(reflection)
        logger.info("[REFLECT] Saved reflection to Postgres.")

        # Embed the reflection itself for future recall
        emb = await self._embedding.embed(reflection.embedding_text())
        payload = reflection.model_dump(mode="json")
        payload["_type"] = "reflection"
        await self._vector_store.upsert(reflection.id, emb, payload)
        logger.info("[REFLECT] Indexed reflection in VectorStore.")

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.REFLECTION_COMPLETED,
                objective_id="",
                payload={"reflection_id": reflection.id},
            ),
        )
        logger.info(
            "[REFLECT] Published REFLECTION_COMPLETED for reflection_id=%s\n", reflection.id
        )

        return reflection
