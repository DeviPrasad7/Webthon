from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid


# ─── Objective (existing, enhanced) ────────────────────────────────
class ObjectiveStatus(str, Enum):
    STAGING = "staging"
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class PlanStep(BaseModel):
    step_number: int
    description: str
    weight: float = 1.0
    status: str = "pending"


class Objective(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    what: str
    why: Optional[str] = None
    context: str
    expected_output: str
    outcome: Optional[str] = None
    plan: Optional[List[PlanStep]] = None
    status: ObjectiveStatus = ObjectiveStatus.STAGING
    workdone: int = 0
    tags: List[str] = Field(default_factory=list)

    def approve_plan(self, steps: List[PlanStep]) -> None:
        self.plan = steps
        self.status = ObjectiveStatus.APPROVED

    def mark_step_completed(self, step_number: int) -> None:
        if not self.plan:
            raise ValueError("No plan attached")
        target = next((s for s in self.plan if s.step_number == step_number), None)
        if not target:
            raise ValueError(f"Step {step_number} not found")
        if target.status == "completed":
            return
        target.status = "completed"
        self._recalculate_progress()

    def _recalculate_progress(self) -> None:
        if not self.plan:
            return
        total_weight = sum(s.weight for s in self.plan)
        if total_weight == 0:
            return
        completed_weight = sum(s.weight for s in self.plan if s.status == "completed")
        self.workdone = int((completed_weight / total_weight) * 100)
        if self.workdone >= 100:
            self.status = ObjectiveStatus.COMPLETED
        else:
            self.status = ObjectiveStatus.IN_PROGRESS

    def embedding_text(self) -> str:
        parts = [self.what, self.context, self.expected_output]
        if self.tags:
            parts.append(" ".join(self.tags))
        return " ".join(parts)


# ─── Learning ──────────────────────────────────────────────────────
class LearningCategory(str, Enum):
    INSIGHT = "insight"
    MISTAKE = "mistake"
    SUCCESS = "success"
    PATTERN = "pattern"
    TOOL = "tool"
    PROCESS = "process"


class Learning(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    content: str
    category: LearningCategory = LearningCategory.INSIGHT
    tags: List[str] = Field(default_factory=list)
    source_objective_id: Optional[str] = None
    confidence: float = 1.0

    def embedding_text(self) -> str:
        return f"{self.content} {' '.join(self.tags)}"


# ─── Decision Log ─────────────────────────────────────────────────
class DecisionLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decision: str
    why: str
    context: str
    alternatives_considered: List[str] = Field(default_factory=list)
    expected_outcome: str
    actual_outcome: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    source_objective_id: Optional[str] = None

    def embedding_text(self) -> str:
        return f"{self.decision} {self.why} {self.context}"


# ─── Reflection ────────────────────────────────────────────────────
class Reflection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    trigger: str  # user question or auto-trigger
    summary: str  # AI-generated reflective summary
    patterns_identified: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    related_objective_ids: List[str] = Field(default_factory=list)
    related_learning_ids: List[str] = Field(default_factory=list)

    def embedding_text(self) -> str:
        return f"{self.trigger} {self.summary}"


# ─── Chat History ──────────────────────────────────────────────────
class ChatMessageRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # "user" or "assistant"
    content: str
    context_used: int = 0
    sources: List[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New Conversation"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    message_count: int = 0
