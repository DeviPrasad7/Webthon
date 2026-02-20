import logging
from typing import List, Dict
from backend.ports.interfaces import VectorStore, EmbeddingProvider

logger = logging.getLogger("jarvis.usecase.search")


class SemanticSearchUseCase:
    """Search across all knowledge (objectives, learnings, decisions, reflections) by meaning."""

    def __init__(
        self,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
    ):
        self._vector_store = vector_store
        self._embedding = embedding

    async def execute(self, query: str, limit: int = 10) -> List[Dict]:
        logger.info("[SEARCH] Query: '%s' (limit=%d)", query[:100], limit)

        embedding = await self._embedding.embed(query)
        results = await self._vector_store.search(embedding, limit=limit)

        logger.info("[SEARCH] Found %d results.", len(results))
        for i, r in enumerate(results, 1):
            item_type = r.get("payload", {}).get("_type", "unknown")
            logger.info("[SEARCH]   %d. [%s] score=%.4f", i, item_type, r.get("score", 0))

        return results
