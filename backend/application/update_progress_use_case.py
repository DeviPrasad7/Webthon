import asyncio
import logging
from backend.domain.models import Objective
from backend.domain.events import DomainEvent, EventType
from backend.ports.interfaces import (
    ObjectiveRepository,
    VectorStore,
    EmbeddingProvider,
    EventBus,
)

logger = logging.getLogger("jarvis.usecase.progress")


class UpdateProgressUseCase:
    def __init__(
        self,
        repo: ObjectiveRepository,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
        event_bus: EventBus,
    ):
        self._repo = repo
        self._vector_store = vector_store
        self._embedding = embedding
        self._event_bus = event_bus

    async def execute(self, objective_id: str, completed_step: int) -> Objective:
        logger.info("[PROGRESS] Marking step %d complete for objective_id=%s", completed_step, objective_id)

        objective = await self._repo.get(objective_id)
        if not objective:
            logger.error("[PROGRESS] Objective not found: %s", objective_id)
            raise ValueError(f"Objective {objective_id} not found")

        objective.mark_step_completed(completed_step)
        logger.info("[PROGRESS] Step %d completed. Progress: %d%% | Status: %s", completed_step, objective.workdone, objective.status.value)

        embedding = await self._embedding.embed(objective.embedding_text())
        payload = objective.model_dump(mode="json")
        payload["_type"] = "objective"

        await asyncio.gather(
            self._repo.update(objective),
            self._vector_store.upsert(objective.id, embedding, payload),
            return_exceptions=True,
        )
        logger.info("[PROGRESS] Stores updated for objective_id=%s", objective_id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.PROGRESS_UPDATED,
                objective_id=objective_id,
                payload={"step": completed_step, "workdone": objective.workdone},
            ),
        )
        logger.info("[PROGRESS] Published PROGRESS_UPDATED for objective_id=%s\n", objective_id)

        return objective
