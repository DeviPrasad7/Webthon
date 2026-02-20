"""
In-memory vector store using numpy cosine similarity.
Replaces Qdrant — simpler, faster, zero external dependencies.
Implements the VectorStore port (DIP / Liskov).
"""

import logging
import threading
import numpy as np
from typing import Dict, List

from backend.ports.interfaces import VectorStore

logger = logging.getLogger("jarvis.infra.vectorstore")


class InMemoryVectorStore(VectorStore):
    """Thread-safe, in-memory vector store with numpy cosine similarity."""

    def __init__(self):
        self._vectors: Dict[str, np.ndarray] = {}
        self._payloads: Dict[str, Dict] = {}
        self._lock = threading.Lock()
        logger.info(
            "\n╔══ VECTOR STORE ▸ INIT ═══════════════════════════════════\n"
            "║  Type : In-Memory (numpy cosine similarity)\n"
            "║  Fast, zero-config, no external service needed\n"
            "╚══════════════════════════════════════════════════════════\n"
        )

    async def upsert(self, item_id: str, embedding: List[float], payload: Dict) -> None:
        vec = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        with self._lock:
            self._vectors[item_id] = vec
            self._payloads[item_id] = payload

        logger.info(
            "  VECTOR ▸ UPSERT | id=%s | dim=%d | type=%s",
            item_id[:12], len(embedding), payload.get("_type", "?"),
        )

    async def search(self, embedding: List[float], limit: int = 5) -> List[Dict]:
        query = np.array(embedding, dtype=np.float32)
        norm = np.linalg.norm(query)
        if norm > 0:
            query = query / norm

        with self._lock:
            if not self._vectors:
                logger.info("  VECTOR ▸ SEARCH | store empty, returning []")
                return []

            ids = list(self._vectors.keys())
            matrix = np.stack([self._vectors[i] for i in ids])

        # Cosine similarity (vectors are pre-normalised)
        scores = matrix @ query
        top_k = min(limit, len(ids))
        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score <= 0:
                continue
            results.append({
                "id": ids[idx],
                "score": score,
                "payload": self._payloads[ids[idx]],
            })

        logger.info("  VECTOR ▸ SEARCH | dim=%d limit=%d → %d results", len(embedding), limit, len(results))
        return results

    async def delete(self, item_id: str) -> None:
        with self._lock:
            self._vectors.pop(item_id, None)
            self._payloads.pop(item_id, None)
        logger.info("  VECTOR ▸ DELETE | id=%s", item_id[:12])
