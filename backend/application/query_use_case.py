import logging
from typing import Optional, List, Dict
from backend.domain.models import Objective, PlanStep
from backend.ports.interfaces import ObjectiveRepository, StagingCache

logger = logging.getLogger("jarvis.usecase.query")


class QueryUseCase:
    def __init__(self, repo: ObjectiveRepository, cache: StagingCache):
        self._repo = repo
        self._cache = cache

    async def get_objective(self, objective_id: str) -> Optional[Objective]:
        logger.info("[QUERY] Fetching objective_id=%s", objective_id)
        result = await self._repo.get(objective_id)
        if result:
            logger.info("[QUERY] Found objective_id=%s (status=%s)", objective_id, result.status.value)
        else:
            logger.info("[QUERY] Objective not found: %s", objective_id)
        return result

    async def list_recent(self, limit: int = 20) -> List[Objective]:
        logger.info("[QUERY] Listing recent objectives (limit=%d)", limit)
        results = await self._repo.list_recent(limit)
        logger.info("[QUERY] Returned %d objectives.", len(results))
        return results

    async def get_staging_status(self, objective_id: str) -> dict:
        logger.info("[QUERY] Checking staging status for objective_id=%s", objective_id)

        cached_obj = await self._cache.retrieve(f"objective:{objective_id}")
        cached_plan = await self._cache.retrieve(f"plan:{objective_id}")

        if not cached_obj and not cached_plan:
            persisted = await self._repo.get(objective_id)
            if persisted:
                logger.info("[QUERY] Found in database: status=%s", persisted.status.value)
                return {
                    "status": persisted.status.value,
                    "objective": persisted.model_dump(mode="json"),
                    "source": "committed",
                }
            logger.info("[QUERY] Not found anywhere: objective_id=%s", objective_id)
            return {"status": "not_found"}

        logger.info("[QUERY] Found in staging cache: obj=%s, plan=%s", bool(cached_obj), bool(cached_plan))

        result = {"status": "staging", "source": "cache"}

        if cached_obj:
            result["objective"] = cached_obj

        if cached_plan:
            result["plan_draft"] = cached_plan

        return result
