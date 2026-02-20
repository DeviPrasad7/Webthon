# ═══════════════════════════════════════════════════════════════════
# JARVIS Backend — Optimised Dockerfile (caches pip layer)
# ═══════════════════════════════════════════════════════════════════
FROM python:3.11-slim AS base

# System deps that rarely change
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Layer 1: pip install (cached unless requirements.txt changes) ──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Layer 2: application code (rebuilt on every code change) ───────
COPY . .

# Show logs immediately (no Python buffering)
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
