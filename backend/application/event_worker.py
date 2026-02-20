import json
import asyncio
import logging
from backend.domain.events import EventType
from backend.infrastructure.redis_adapter import RedisEventBus, RedisStagingCache
from backend.application.ingest_use_case import IngestUseCase

logger = logging.getLogger("jarvis.worker")


class EventWorker:
    def __init__(
        self,
        event_bus: RedisEventBus,
        cache: RedisStagingCache,
        ingest_use_case: IngestUseCase,
    ):
        self._event_bus = event_bus
        self._cache = cache
        self._ingest = ingest_use_case
        self._running = False
        self._processed_keys: set = set()

    async def start(self):
        self._running = True
        logger.info("[WORKER] Event worker started. Listening on 'objective_events'...\n")
        try:
            async for msg_id, data in self._event_bus.subscribe(
                "objective_events", "objective_workers", "worker_1"
            ):
                if not self._running:
                    break
                await self._handle(data)
        except asyncio.CancelledError:
            logger.info("[WORKER] Event worker cancelled.")
        except Exception as e:
            logger.error("[WORKER] Event worker error: %s", e, exc_info=True)

    async def stop(self):
        self._running = False
        logger.info("[WORKER] Event worker stopping...")

    async def _handle(self, data: dict) -> None:
        event_type = data.get(b"event_type", b"").decode()
        objective_id = data.get(b"objective_id", b"").decode()
        idempotency_key = data.get(b"idempotency_key", b"").decode()

        logger.info("[WORKER] Received event: %s | objective_id=%s", event_type, objective_id)

        if idempotency_key and idempotency_key in self._processed_keys:
            logger.info("[WORKER] Duplicate event (idempotency_key=%s). Skipping.", idempotency_key)
            return
        if idempotency_key:
            self._processed_keys.add(idempotency_key)
            if len(self._processed_keys) > 10000:
                logger.info("[WORKER] Clearing idempotency key cache (>10k entries).")
                self._processed_keys.clear()

        try:
            if event_type == EventType.USER_INPUT_RECEIVED.value:
                raw_payload = json.loads(data.get(b"payload", b"{}").decode())
                raw_text = raw_payload.get("raw_text", "")
                logger.info("[WORKER] Processing USER_INPUT_RECEIVED (%d chars)...", len(raw_text))
                await self._ingest.process_input(objective_id, raw_text)
                logger.info("[WORKER] Finished processing USER_INPUT_RECEIVED for objective_id=%s\n", objective_id)
            else:
                logger.info("[WORKER] Event %s acknowledged (no handler).", event_type)
        except Exception as e:
            logger.error("[WORKER] FAILED processing %s for %s: %s", event_type, objective_id, e, exc_info=True)
