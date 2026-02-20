import asyncio
import logging
from typing import List, Optional
from backend.domain.models import Objective, PlanStep, ObjectiveStatus
from backend.domain.events import DomainEvent, EventType
from backend.ports.interfaces import (
    ObjectiveRepository,
    VectorStore,
    EmbeddingProvider,
    StagingCache,
    EventBus,
)

logger = logging.getLogger("jarvis.usecase.confirm_plan")


class ConfirmPlanUseCase:
    def __init__(
        self,
        cache: StagingCache,
        repo: ObjectiveRepository,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
        event_bus: EventBus,
    ):
        self._cache = cache
        self._repo = repo
        self._vector_store = vector_store
        self._embedding = embedding
        self._event_bus = event_bus

    async def execute(
        self,
        objective_id: str,
        approved: bool,
        modifications: Optional[List[PlanStep]] = None,
    ) -> Objective:
        logger.info("[CONFIRM] Processing plan confirmation for objective_id=%s (approved=%s)", objective_id, approved)

        cached_obj = await self._cache.retrieve(f"objective:{objective_id}")
        if not cached_obj:
            logger.error("[CONFIRM] No staged objective found for objective_id=%s", objective_id)
            raise ValueError(f"No staged objective found for {objective_id}")

        objective = Objective(**cached_obj)

        if not approved:
            objective.status = ObjectiveStatus.FAILED
            await asyncio.gather(
                self._cache.remove(f"objective:{objective_id}"),
                self._cache.remove(f"plan:{objective_id}"),
                self._cache.remove(f"raw:{objective_id}"),
            )
            logger.info("[CONFIRM] Plan REJECTED for objective_id=%s. Cache cleared.\n", objective_id)
            return objective

        if modifications:
            steps = modifications
            logger.info("[CONFIRM] Using %d modified steps.", len(steps))
        else:
            cached_plan = await self._cache.retrieve(f"plan:{objective_id}")
            if not cached_plan:
                logger.error("[CONFIRM] No plan draft found for objective_id=%s", objective_id)
                raise ValueError("No plan draft found in staging")
            steps = [PlanStep(**s) for s in cached_plan["steps"]]
            logger.info("[CONFIRM] Using %d cached plan steps.", len(steps))

        objective.approve_plan(steps)
        logger.info("[CONFIRM] Plan approved. Persisting objective_id=%s ...", objective_id)

        await self._persist_committed(objective)

        await asyncio.gather(
            self._cache.remove(f"objective:{objective_id}"),
            self._cache.remove(f"plan:{objective_id}"),
            self._cache.remove(f"raw:{objective_id}"),
        )
        logger.info("[CONFIRM] Cache cleared for objective_id=%s", objective_id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.OBJECTIVE_PERSISTED,
                objective_id=objective_id,
                payload={},
            ),
        )
        logger.info("[CONFIRM] Published OBJECTIVE_PERSISTED for objective_id=%s\n", objective_id)

        return objective

    async def _persist_committed(self, objective: Objective) -> None:
        logger.info("[PERSIST] Generating embedding for objective_id=%s ...", objective.id)
        embedding = await self._embedding.embed(objective.embedding_text())
        payload = objective.model_dump(mode="json")
        payload["_type"] = "objective"

        logger.info("[PERSIST] Saving to Postgres + VectorStore for objective_id=%s ...", objective.id)
        results = await asyncio.gather(
            self._repo.save(objective),
            self._vector_store.upsert(objective.id, embedding, payload),
            return_exceptions=True,
        )

        pg_result, vec_result = results

        if isinstance(pg_result, Exception) and isinstance(vec_result, Exception):
            logger.error("[PERSIST] Both stores FAILED for objective_id=%s: pg=%s, vec=%s", objective.id, pg_result, vec_result)
            raise RuntimeError("Both stores failed") from pg_result

        if isinstance(pg_result, Exception):
            logger.error("[PERSIST] Postgres FAILED for objective_id=%s. Rolling back vector store. Error: %s", objective.id, pg_result)
            await self._vector_store.delete(objective.id)
            raise RuntimeError("Postgres failed, rolled back vector store") from pg_result

        if isinstance(vec_result, Exception):
            logger.warning("[PERSIST] VectorStore FAILED for objective_id=%s. Retrying... Error: %s", objective.id, vec_result)
            try:
                embedding = await self._embedding.embed(objective.embedding_text())
                await self._vector_store.upsert(objective.id, embedding, payload)
                logger.info("[PERSIST] VectorStore retry succeeded for objective_id=%s", objective.id)
            except Exception as retry_err:
                logger.error("[PERSIST] VectorStore retry also FAILED for objective_id=%s: %s", objective.id, retry_err)

        logger.info("[PERSIST] Objective_id=%s persisted successfully.", objective.id)
