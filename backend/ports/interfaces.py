from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from backend.domain.models import (
    Objective, PlanStep, Learning, DecisionLog, Reflection,
    ChatMessageRecord, ChatSession,
)
from backend.domain.events import DomainEvent


class InputExtractor(ABC):
    @abstractmethod
    async def extract(self, content: bytes, filename: str) -> str:
        pass


class StructuringAgent(ABC):
    @abstractmethod
    async def structure(self, raw_text: str) -> Objective:
        pass


class PlanningAgent(ABC):
    @abstractmethod
    async def draft_plan(self, objective: Objective) -> List[PlanStep]:
        pass


class ReflectionAgent(ABC):
    """AI agent that produces reflections from context."""

    @abstractmethod
    async def reflect(
        self,
        trigger: str,
        related_objectives: List[dict],
        related_learnings: List[dict],
        related_decisions: List[dict],
    ) -> Reflection:
        pass


class InsightAgent(ABC):
    """AI agent that extracts learnings/suggestions from a completed objective."""

    @abstractmethod
    async def extract_learnings(self, objective: Objective) -> List[Learning]:
        pass


class ObjectiveRepository(ABC):
    @abstractmethod
    async def save(self, objective: Objective) -> None:
        pass

    @abstractmethod
    async def get(self, objective_id: str) -> Optional[Objective]:
        pass

    @abstractmethod
    async def update(self, objective: Objective) -> None:
        pass

    @abstractmethod
    async def list_recent(self, limit: int = 20) -> List[Objective]:
        pass


class LearningRepository(ABC):
    @abstractmethod
    async def save(self, learning: Learning) -> None:
        pass

    @abstractmethod
    async def get(self, learning_id: str) -> Optional[Learning]:
        pass

    @abstractmethod
    async def list_recent(self, limit: int = 20) -> List[Learning]:
        pass


class DecisionLogRepository(ABC):
    @abstractmethod
    async def save(self, decision: DecisionLog) -> None:
        pass

    @abstractmethod
    async def get(self, decision_id: str) -> Optional[DecisionLog]:
        pass

    @abstractmethod
    async def list_recent(self, limit: int = 20) -> List[DecisionLog]:
        pass


class ReflectionRepository(ABC):
    @abstractmethod
    async def save(self, reflection: Reflection) -> None:
        pass

    @abstractmethod
    async def list_recent(self, limit: int = 10) -> List[Reflection]:
        pass


class VectorStore(ABC):
    @abstractmethod
    async def upsert(self, objective_id: str, embedding: List[float], payload: Dict) -> None:
        pass

    @abstractmethod
    async def search(self, embedding: List[float], limit: int = 5) -> List[Dict]:
        pass

    @abstractmethod
    async def delete(self, objective_id: str) -> None:
        pass


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        pass


class StagingCache(ABC):
    @abstractmethod
    async def store(self, key: str, data: dict, ttl: int) -> None:
        pass

    @abstractmethod
    async def retrieve(self, key: str) -> Optional[dict]:
        pass

    @abstractmethod
    async def remove(self, key: str) -> None:
        pass


class EventBus(ABC):
    @abstractmethod
    async def publish(self, stream: str, event: DomainEvent) -> None:
        pass

    @abstractmethod
    async def subscribe(self, stream: str, group: str, consumer: str):
        pass


class ChatHistoryRepository(ABC):
    @abstractmethod
    async def create_session(self, session: ChatSession) -> None:
        pass

    @abstractmethod
    async def save_message(self, message: ChatMessageRecord) -> None:
        pass

    @abstractmethod
    async def get_session_messages(self, session_id: str, limit: int = 50) -> List[ChatMessageRecord]:
        pass

    @abstractmethod
    async def list_sessions(self, limit: int = 20) -> List[ChatSession]:
        pass

    @abstractmethod
    async def get_session(self, session_id: str) -> Optional[ChatSession]:
        pass

    @abstractmethod
    async def update_session(self, session: ChatSession) -> None:
        pass

    @abstractmethod
    async def delete_session(self, session_id: str) -> None:
        pass
