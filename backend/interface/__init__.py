from pydantic import BaseModel
from typing import Optional, List
from backend.domain.models import PlanStep, ObjectiveStatus


# ─── Objective DTOs ────────────────────────────────────────────────
class IngestTextRequest(BaseModel):
    text: str


class IngestResponse(BaseModel):
    objective_id: str
    status: str


class StatusResponse(BaseModel):
    objective_id: str
    status: str
    source: str
    objective: Optional[dict] = None
    plan_draft: Optional[dict] = None


class ApprovalRequest(BaseModel):
    approved: bool
    modifications: Optional[List[PlanStep]] = None


class ObjectiveResponse(BaseModel):
    id: str
    what: str
    why: Optional[str] = None
    context: str
    expected_output: str
    status: ObjectiveStatus
    workdone: int = 0
    plan: Optional[List[PlanStep]] = None
    tags: List[str] = []
    created_at: Optional[str] = None


class ProgressRequest(BaseModel):
    completed_step: int


class ProgressResponse(BaseModel):
    objective_id: str
    workdone: int
    status: ObjectiveStatus
    completed_steps: int
    total_steps: int


# ─── Learning DTOs ─────────────────────────────────────────────────
class CaptureLearningRequest(BaseModel):
    content: str
    category: str = "insight"
    tags: List[str] = []
    source_objective_id: Optional[str] = None


class LearningResponse(BaseModel):
    id: str
    content: str
    category: str
    tags: List[str]
    source_objective_id: Optional[str] = None
    confidence: float = 1.0
    created_at: str


# ─── Decision DTOs ─────────────────────────────────────────────────
class LogDecisionRequest(BaseModel):
    decision: str
    why: str
    context: str
    alternatives_considered: List[str] = []
    expected_outcome: str = ""
    tags: List[str] = []
    source_objective_id: Optional[str] = None


class DecisionResponse(BaseModel):
    id: str
    decision: str
    why: str
    context: str
    alternatives_considered: List[str]
    expected_outcome: str
    tags: List[str]
    created_at: str


# ─── Reflection DTOs ──────────────────────────────────────────────
class ReflectionRequest(BaseModel):
    trigger: str


class ReflectionResponse(BaseModel):
    id: str
    trigger: str
    summary: str
    patterns_identified: List[str]
    suggestions: List[str]
    created_at: str


# ─── Search DTO ────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    limit: int = 10


class SearchResult(BaseModel):
    id: str
    score: float
    payload: dict


# ─── Chat DTO ──────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str = "user"
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = None


class ChatResponse(BaseModel):
    reply: str
    context_used: int = 0
    sources: List[dict] = []
    session_id: Optional[str] = None
    auto_captured: List[dict] = []


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: List[dict]

