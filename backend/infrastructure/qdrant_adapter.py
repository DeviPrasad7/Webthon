import logging
from typing import Dict, List
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance, models
from backend.ports.interfaces import VectorStore
from backend.config import get_settings

logger = logging.getLogger("jarvis.infra.qdrant")


class QdrantVectorStore(VectorStore):
    def __init__(self):
        settings = get_settings()
        self._client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        self._collection = settings.qdrant_collection
        self._dimension = settings.embedding_dimension
        logger.info(
            "\n╔══ QDRANT ▸ INIT ═════════════════════════════════════════\n"
            "║  Host       : %s:%s\n"
            "║  Collection : %s\n"
            "║  Dimension  : %d\n"
            "╚══════════════════════════════════════════════════════════\n",
            settings.qdrant_host, settings.qdrant_port,
            self._collection, self._dimension,
        )
        self._ensure_collection()

    def _ensure_collection(self):
        names = [c.name for c in self._client.get_collections().collections]
        if self._collection not in names:
            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=self._dimension, distance=Distance.COSINE),
            )
            logger.info("  QDRANT ▸ Collection '%s' CREATED (dim=%d, cosine)", self._collection, self._dimension)
        else:
            logger.debug("  QDRANT ▸ Collection '%s' already exists", self._collection)

    async def upsert(self, objective_id: str, embedding: List[float], payload: Dict) -> None:
        logger.info(
            "\n╔══ QDRANT ▸ UPSERT ═══════════════════════════════════════\n"
            "║  ID        : %s\n"
            "║  Vec dim   : %d\n"
            "║  Payload   : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            objective_id, len(embedding),
            ", ".join(f"{k}={v}" for k, v in payload.items() if k != "text"),
        )
        self._client.upsert(
            collection_name=self._collection,
            points=[PointStruct(id=objective_id, vector=embedding, payload=payload)],
        )

    async def search(self, embedding: List[float], limit: int = 5) -> List[Dict]:
        logger.info(
            "\n╔══ QDRANT ▸ SEARCH ═══════════════════════════════════════\n"
            "║  Vec dim   : %d\n"
            "║  Limit     : %d\n"
            "╚══════════════════════════════════════════════════════════\n",
            len(embedding), limit,
        )
        # qdrant-client >= 1.17 uses query_points instead of search
        response = self._client.query_points(
            collection_name=self._collection,
            query=embedding,
            limit=limit,
        )
        results = response.points
        logger.info("  QDRANT ▸ SEARCH returned %d results", len(results))
        for i, r in enumerate(results):
            logger.debug("    [%d] id=%s  score=%.4f", i, r.id, r.score)
        return [{"id": r.id, "score": r.score, "payload": r.payload} for r in results]

    async def delete(self, objective_id: str) -> None:
        logger.info("  QDRANT ▸ DELETE | ID: %s", objective_id)
        self._client.delete(
            collection_name=self._collection,
            points_selector=models.PointIdsList(points=[objective_id]),
        )
