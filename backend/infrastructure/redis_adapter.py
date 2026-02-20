import json
import logging
from typing import Optional
from redis.asyncio import Redis
from backend.ports.interfaces import StagingCache, EventBus
from backend.domain.events import DomainEvent
from backend.config import get_settings

logger = logging.getLogger("jarvis.infra.redis")


class RedisStagingCache(StagingCache):
    def __init__(self, client: Redis):
        self._client = client
        self._settings = get_settings()

    async def store(self, key: str, data: dict, ttl: int = 0) -> None:
        effective_ttl = ttl or self._settings.staging_ttl_seconds
        logger.info(
            "\n╔══ REDIS CACHE ▸ STORE ═══════════════════════════════════\n"
            "║  Key     : staging:%s\n"
            "║  TTL     : %d seconds\n"
            "║  Size    : %d bytes\n"
            "╚══════════════════════════════════════════════════════════\n",
            key, effective_ttl, len(json.dumps(data, default=str)),
        )
        await self._client.setex(f"staging:{key}", effective_ttl, json.dumps(data, default=str))

    async def retrieve(self, key: str) -> Optional[dict]:
        raw = await self._client.get(f"staging:{key}")
        if raw is None:
            logger.debug("  REDIS CACHE ▸ MISS  | Key: staging:%s", key)
            return None
        logger.debug("  REDIS CACHE ▸ HIT   | Key: staging:%s | Size: %d bytes", key, len(raw))
        return json.loads(raw)

    async def remove(self, key: str) -> None:
        logger.info("  REDIS CACHE ▸ REMOVE | Key: staging:%s", key)
        await self._client.delete(f"staging:{key}")


class RedisEventBus(EventBus):
    def __init__(self, client: Redis):
        self._client = client

    async def publish(self, stream: str, event: DomainEvent) -> None:
        logger.info(
            "\n╔══ REDIS STREAM ▸ PUBLISH ════════════════════════════════\n"
            "║  Stream  : %s\n"
            "║  Event   : %s\n"
            "║  ObjectID: %s\n"
            "║  Idemp.  : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            stream, event.event_type.value, event.objective_id,
            event.idempotency_key or "(none)",
        )
        await self._client.xadd(
            stream,
            {
                "event_type": event.event_type.value,
                "objective_id": event.objective_id,
                "payload": json.dumps(event.payload, default=str),
                "idempotency_key": event.idempotency_key or "",
            },
            maxlen=10000,
        )

    async def subscribe(self, stream: str, group: str, consumer: str):
        logger.info(
            "\n╔══ REDIS STREAM ▸ SUBSCRIBE ══════════════════════════════\n"
            "║  Stream   : %s\n"
            "║  Group    : %s\n"
            "║  Consumer : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            stream, group, consumer,
        )
        try:
            await self._client.xgroup_create(stream, group, id="0", mkstream=True)
            logger.info("  REDIS STREAM ▸ Consumer group '%s' created on '%s'", group, stream)
        except Exception:
            logger.debug("  REDIS STREAM ▸ Consumer group '%s' already exists on '%s'", group, stream)

        while True:
            messages = await self._client.xreadgroup(
                group, consumer, {stream: ">"}, count=10, block=5000
            )
            for _stream, entries in messages:
                for msg_id, data in entries:
                    logger.debug(
                        "  REDIS STREAM ▸ RECV  | MsgID: %s | Event: %s",
                        msg_id.decode() if isinstance(msg_id, bytes) else msg_id,
                        data.get(b"event_type", data.get("event_type", b"?"))
                    )
                    yield msg_id, data
                    await self._client.xack(stream, group, msg_id)
