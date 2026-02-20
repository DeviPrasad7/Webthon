from pydantic import BaseModel
from typing import Optional
from enum import Enum


class EventType(str, Enum):
    # Objective lifecycle
    USER_INPUT_RECEIVED = "user_input_received"
    OBJECTIVE_STRUCTURED = "objective_structured"
    PLAN_DRAFTED = "plan_drafted"
    PLAN_CONFIRMED = "plan_confirmed"
    PLAN_REJECTED = "plan_rejected"
    OBJECTIVE_PERSISTED = "objective_persisted"
    PROGRESS_UPDATED = "progress_updated"
    PERSISTENCE_FAILED = "persistence_failed"
    # JARVIS: learnings, decisions, reflections
    LEARNING_CAPTURED = "learning_captured"
    DECISION_LOGGED = "decision_logged"
    REFLECTION_REQUESTED = "reflection_requested"
    REFLECTION_COMPLETED = "reflection_completed"
    INSIGHT_GENERATED = "insight_generated"


class DomainEvent(BaseModel):
    event_type: EventType
    objective_id: str  # can be "" for non-objective events
    payload: dict
    idempotency_key: Optional[str] = None
