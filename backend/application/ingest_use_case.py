import asyncio
import uuid
import logging
from typing import Optional
from backend.domain.models import Objective, ObjectiveStatus
from backend.domain.events import DomainEvent, EventType
from backend.ports.interfaces import (
    InputExtractor,
    StructuringAgent,
    PlanningAgent,
    StagingCache,
    EventBus,
)

logger = logging.getLogger("jarvis.usecase.ingest")


class IngestUseCase:
    def __init__(
        self,
        extractor: InputExtractor,
        structuring_agent: StructuringAgent,
        planning_agent: PlanningAgent,
        cache: StagingCache,
        event_bus: EventBus,
    ):
        self._extractor = extractor
        self._structuring_agent = structuring_agent
        self._planning_agent = planning_agent
        self._cache = cache
        self._event_bus = event_bus

    async def execute(
        self,
        text: Optional[str] = None,
        file_content: Optional[bytes] = None,
        filename: Optional[str] = None,
    ) -> str:
        if file_content and filename:
            logger.info("[INGEST] Extracting text from file: %s", filename)
            raw_text = await self._extractor.extract(file_content, filename)
            logger.info("[INGEST] Extracted %d chars from file.", len(raw_text))
        elif text:
            raw_text = text.strip()
            logger.info("[INGEST] Received text input (%d chars).", len(raw_text))
        else:
            logger.error("[INGEST] No input provided.")
            raise ValueError("Provide text or file")

        objective_id = str(uuid.uuid4())
        logger.info("[INGEST] Assigned objective_id=%s", objective_id)

        await self._cache.store(
            f"raw:{objective_id}",
            {"raw_text": raw_text, "objective_id": objective_id},
            ttl=3600,
        )
        logger.info("[INGEST] Raw text cached for objective_id=%s", objective_id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.USER_INPUT_RECEIVED,
                objective_id=objective_id,
                payload={"raw_text": raw_text},
                idempotency_key=objective_id,
            ),
        )
        logger.info("[INGEST] Published USER_INPUT_RECEIVED event for objective_id=%s\n", objective_id)

        return objective_id

    async def process_input(self, objective_id: str, raw_text: str) -> None:
        logger.info("[PROCESS] Structuring input for objective_id=%s ...", objective_id)

        structure_task = asyncio.create_task(
            self._structuring_agent.structure(raw_text)
        )

        objective = await structure_task
        objective.id = objective_id
        objective.status = ObjectiveStatus.PLANNING
        logger.info(
            "[PROCESS] Structured: what='%s', tags=%s",
            objective.what[:80], objective.tags,
        )

        logger.info("[PROCESS] Drafting plan for objective_id=%s ...", objective_id)
        plan_steps = await self._planning_agent.draft_plan(objective)
        logger.info("[PROCESS] Plan drafted: %d steps.", len(plan_steps))

        await asyncio.gather(
            self._cache.store(
                f"objective:{objective_id}",
                objective.model_dump(mode="json"),
                ttl=3600,
            ),
            self._cache.store(
                f"plan:{objective_id}",
                {"steps": [s.model_dump() for s in plan_steps]},
                ttl=3600,
            ),
        )
        logger.info("[PROCESS] Objective + plan cached for objective_id=%s", objective_id)

        await self._event_bus.publish(
            "objective_events",
            DomainEvent(
                event_type=EventType.PLAN_DRAFTED,
                objective_id=objective_id,
                payload={},
            ),
        )
        logger.info("[PROCESS] Published PLAN_DRAFTED event for objective_id=%s\n", objective_id)
