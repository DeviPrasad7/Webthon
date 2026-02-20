import logging
from typing import List
from sentence_transformers import SentenceTransformer
from backend.ports.interfaces import EmbeddingProvider
from backend.config import get_settings

logger = logging.getLogger("jarvis.infra.embedding")


class LocalEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        settings = get_settings()
        logger.info(
            "\n╔══ EMBEDDING ▸ INIT ══════════════════════════════════════\n"
            "║  Model : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            settings.embedding_model,
        )
        self._model = SentenceTransformer(settings.embedding_model)
        logger.info("  EMBEDDING ▸ Model loaded successfully")

    async def embed(self, text: str) -> List[float]:
        preview = (text[:80] + "…") if len(text) > 80 else text
        logger.info(
            "\n╔══ EMBEDDING ▸ ENCODE ════════════════════════════════════\n"
            "║  Text   : %s\n"
            "║  Length : %d chars\n"
            "╚══════════════════════════════════════════════════════════\n",
            preview, len(text),
        )
        vector = self._model.encode(text, normalize_embeddings=True)
        logger.debug("  EMBEDDING ▸ Output dimension: %d", len(vector))
        return vector.tolist()
