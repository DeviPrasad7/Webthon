import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.infrastructure.database import init_db, shutdown_db
from backend.application.container import create_event_worker, shutdown_redis
from backend.interface.routes import router

# ─── Logging Configuration ─────────────────────────────────────────
LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | %(name)-35s | %(message)s"
)
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    stream=sys.stdout,
)

# Quiet down noisy third-party loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("sentence_transformers").setLevel(logging.WARNING)

logger = logging.getLogger("jarvis.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("  JARVIS — Personal Business Assistant")
    logger.info("=" * 60)

    logger.info("[STARTUP] Initializing database...")
    await init_db()
    logger.info("[STARTUP] Database ready.")

    logger.info("[STARTUP] Creating event worker...")
    worker = await create_event_worker()
    worker_task = asyncio.create_task(worker.start())
    logger.info("[STARTUP] Event worker running.")

    logger.info("[STARTUP] All systems operational.\n")
    yield

    logger.info("[SHUTDOWN] Stopping event worker...")
    await worker.stop()
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass
    logger.info("[SHUTDOWN] Event worker stopped.")

    logger.info("[SHUTDOWN] Closing Redis...")
    await shutdown_redis()
    logger.info("[SHUTDOWN] Redis closed.")

    logger.info("[SHUTDOWN] Closing database...")
    await shutdown_db()
    logger.info("[SHUTDOWN] Database closed.")

    logger.info("[SHUTDOWN] JARVIS shutdown complete.\n")


app = FastAPI(
    title="JARVIS — Personal Business Assistant",
    description="Capture learnings, reflect on decisions, and support day-to-day thinking for solo business owners.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "jarvis", "version": "2.0.0"}
