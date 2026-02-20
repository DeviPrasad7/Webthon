import logging
from typing import Optional, List
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON, select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.infrastructure.database import Base
from backend.ports.interfaces import (
    ObjectiveRepository, LearningRepository, DecisionLogRepository, ReflectionRepository,
    ChatHistoryRepository,
)
from backend.domain.models import (
    Objective, PlanStep, ObjectiveStatus,
    Learning, LearningCategory,
    DecisionLog,
    Reflection,
    ChatMessageRecord, ChatSession,
)

logger = logging.getLogger("jarvis.infra.postgres")


# ─── Tables ────────────────────────────────────────────────────────
class ObjectiveTable(Base):
    __tablename__ = "objectives"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    what = Column(Text, nullable=False)
    why = Column(Text, nullable=True)
    context = Column(Text, nullable=False)
    expected_output = Column(Text, nullable=False)
    outcome = Column(Text, nullable=True)
    plan = Column(JSON, nullable=True)
    status = Column(String, default="staging", index=True)
    workdone = Column(Integer, default=0)
    tags = Column(JSON, nullable=True)


class LearningTable(Base):
    __tablename__ = "learnings"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=False, default="insight")
    tags = Column(JSON, nullable=True)
    source_objective_id = Column(String, nullable=True, index=True)
    confidence = Column(Float, default=1.0)


class DecisionLogTable(Base):
    __tablename__ = "decision_logs"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    decision = Column(Text, nullable=False)
    why = Column(Text, nullable=False)
    context = Column(Text, nullable=False)
    alternatives_considered = Column(JSON, nullable=True)
    expected_outcome = Column(Text, nullable=False)
    actual_outcome = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)
    source_objective_id = Column(String, nullable=True, index=True)


class ReflectionTable(Base):
    __tablename__ = "reflections"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    trigger = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    patterns_identified = Column(JSON, nullable=True)
    suggestions = Column(JSON, nullable=True)
    related_objective_ids = Column(JSON, nullable=True)
    related_learning_ids = Column(JSON, nullable=True)


class ChatSessionTable(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    title = Column(Text, nullable=False, default="New Conversation")
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)
    message_count = Column(Integer, default=0)


class ChatMessageTable(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    context_used = Column(Integer, default=0)
    sources = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)


# ─── Repositories ──────────────────────────────────────────────────
class PostgresObjectiveRepository(ObjectiveRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, objective: Objective) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ OBJECTIVE SAVE ═════════════════════════════\n"
            "║  ID     : %s\n"
            "║  What   : %s\n"
            "║  Status : %s\n"
            "║  Tags   : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            objective.id, objective.what[:60], objective.status.value,
            ", ".join(objective.tags) if objective.tags else "(none)",
        )
        row = ObjectiveTable(
            id=objective.id,
            created_at=objective.created_at,
            what=objective.what,
            why=objective.why,
            context=objective.context,
            expected_output=objective.expected_output,
            outcome=objective.outcome,
            plan=self._serialize_plan(objective.plan),
            status=objective.status.value,
            workdone=objective.workdone,
            tags=objective.tags,
        )
        self._session.add(row)
        await self._session.commit()

    async def get(self, objective_id: str) -> Optional[Objective]:
        logger.debug("  POSTGRES ▸ OBJECTIVE GET | ID: %s", objective_id)
        result = await self._session.execute(
            select(ObjectiveTable).where(ObjectiveTable.id == objective_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning("  POSTGRES ▸ OBJECTIVE GET | NOT FOUND: %s", objective_id)
            return None
        logger.debug("  POSTGRES ▸ OBJECTIVE GET | FOUND: %s | Status: %s", objective_id, row.status)
        return self._to_domain(row)

    async def update(self, objective: Objective) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ OBJECTIVE UPDATE ═══════════════════════════\n"
            "║  ID       : %s\n"
            "║  Status   : %s\n"
            "║  Workdone : %d%%\n"
            "╚══════════════════════════════════════════════════════════\n",
            objective.id, objective.status.value, objective.workdone,
        )
        result = await self._session.execute(
            select(ObjectiveTable).where(ObjectiveTable.id == objective.id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"Objective {objective.id} not found in database")
        row.what = objective.what
        row.why = objective.why
        row.context = objective.context
        row.expected_output = objective.expected_output
        row.outcome = objective.outcome
        row.plan = self._serialize_plan(objective.plan)
        row.status = objective.status.value
        row.workdone = objective.workdone
        row.tags = objective.tags
        await self._session.commit()

    async def list_recent(self, limit: int = 20) -> List[Objective]:
        logger.debug("  POSTGRES ▸ OBJECTIVE LIST_RECENT | limit=%d", limit)
        result = await self._session.execute(
            select(ObjectiveTable).order_by(ObjectiveTable.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ OBJECTIVE LIST_RECENT | returned %d rows", len(rows))
        return [self._to_domain(row) for row in rows]

    @staticmethod
    def _serialize_plan(plan: Optional[List[PlanStep]]) -> Optional[list]:
        if not plan:
            return None
        return [s.model_dump() for s in plan]

    @staticmethod
    def _to_domain(row: ObjectiveTable) -> Objective:
        plan = None
        if row.plan:
            plan = [PlanStep(**s) for s in row.plan]
        return Objective(
            id=row.id,
            created_at=row.created_at,
            what=row.what,
            why=row.why,
            context=row.context,
            expected_output=row.expected_output,
            outcome=row.outcome,
            plan=plan,
            status=ObjectiveStatus(row.status),
            workdone=row.workdone,
            tags=row.tags or [],
        )


class PostgresLearningRepository(LearningRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, learning: Learning) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ LEARNING SAVE ══════════════════════════════\n"
            "║  ID       : %s\n"
            "║  Category : %s\n"
            "║  Tags     : %s\n"
            "║  Content  : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            learning.id, learning.category.value,
            ", ".join(learning.tags) if learning.tags else "(none)",
            (learning.content[:60] + "…") if len(learning.content) > 60 else learning.content,
        )
        row = LearningTable(
            id=learning.id,
            created_at=learning.created_at,
            content=learning.content,
            category=learning.category.value,
            tags=learning.tags,
            source_objective_id=learning.source_objective_id,
            confidence=learning.confidence,
        )
        self._session.add(row)
        await self._session.commit()

    async def get(self, learning_id: str) -> Optional[Learning]:
        logger.debug("  POSTGRES ▸ LEARNING GET | ID: %s", learning_id)
        result = await self._session.execute(
            select(LearningTable).where(LearningTable.id == learning_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning("  POSTGRES ▸ LEARNING GET | NOT FOUND: %s", learning_id)
            return None
        return Learning(
            id=row.id,
            created_at=row.created_at,
            content=row.content,
            category=LearningCategory(row.category),
            tags=row.tags or [],
            source_objective_id=row.source_objective_id,
            confidence=row.confidence,
        )

    async def list_recent(self, limit: int = 20) -> List[Learning]:
        logger.debug("  POSTGRES ▸ LEARNING LIST_RECENT | limit=%d", limit)
        result = await self._session.execute(
            select(LearningTable).order_by(LearningTable.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ LEARNING LIST_RECENT | returned %d rows", len(rows))
        return [
            Learning(
                id=row.id,
                created_at=row.created_at,
                content=row.content,
                category=LearningCategory(row.category),
                tags=row.tags or [],
                source_objective_id=row.source_objective_id,
                confidence=row.confidence,
            )
            for row in rows
        ]


class PostgresDecisionLogRepository(DecisionLogRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, decision: DecisionLog) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ DECISION SAVE ══════════════════════════════\n"
            "║  ID       : %s\n"
            "║  Decision : %s\n"
            "║  Tags     : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            decision.id,
            (decision.decision[:60] + "…") if len(decision.decision) > 60 else decision.decision,
            ", ".join(decision.tags) if decision.tags else "(none)",
        )
        row = DecisionLogTable(
            id=decision.id,
            created_at=decision.created_at,
            decision=decision.decision,
            why=decision.why,
            context=decision.context,
            alternatives_considered=decision.alternatives_considered,
            expected_outcome=decision.expected_outcome,
            actual_outcome=decision.actual_outcome,
            tags=decision.tags,
            source_objective_id=decision.source_objective_id,
        )
        self._session.add(row)
        await self._session.commit()

    async def get(self, decision_id: str) -> Optional[DecisionLog]:
        logger.debug("  POSTGRES ▸ DECISION GET | ID: %s", decision_id)
        result = await self._session.execute(
            select(DecisionLogTable).where(DecisionLogTable.id == decision_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning("  POSTGRES ▸ DECISION GET | NOT FOUND: %s", decision_id)
            return None
        return DecisionLog(
            id=row.id,
            created_at=row.created_at,
            decision=row.decision,
            why=row.why,
            context=row.context,
            alternatives_considered=row.alternatives_considered or [],
            expected_outcome=row.expected_outcome,
            actual_outcome=row.actual_outcome,
            tags=row.tags or [],
            source_objective_id=row.source_objective_id,
        )

    async def list_recent(self, limit: int = 20) -> List[DecisionLog]:
        logger.debug("  POSTGRES ▸ DECISION LIST_RECENT | limit=%d", limit)
        result = await self._session.execute(
            select(DecisionLogTable).order_by(DecisionLogTable.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ DECISION LIST_RECENT | returned %d rows", len(rows))
        return [
            DecisionLog(
                id=row.id,
                created_at=row.created_at,
                decision=row.decision,
                why=row.why,
                context=row.context,
                alternatives_considered=row.alternatives_considered or [],
                expected_outcome=row.expected_outcome,
                actual_outcome=row.actual_outcome,
                tags=row.tags or [],
                source_objective_id=row.source_objective_id,
            )
            for row in rows
        ]


class PostgresReflectionRepository(ReflectionRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, reflection: Reflection) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ REFLECTION SAVE ════════════════════════════\n"
            "║  ID       : %s\n"
            "║  Trigger  : %s\n"
            "║  Patterns : %d\n"
            "╚══════════════════════════════════════════════════════════\n",
            reflection.id,
            (reflection.trigger[:60] + "…") if len(reflection.trigger) > 60 else reflection.trigger,
            len(reflection.patterns_identified) if reflection.patterns_identified else 0,
        )
        row = ReflectionTable(
            id=reflection.id,
            created_at=reflection.created_at,
            trigger=reflection.trigger,
            summary=reflection.summary,
            patterns_identified=reflection.patterns_identified,
            suggestions=reflection.suggestions,
            related_objective_ids=reflection.related_objective_ids,
            related_learning_ids=reflection.related_learning_ids,
        )
        self._session.add(row)
        await self._session.commit()

    async def list_recent(self, limit: int = 10) -> List[Reflection]:
        logger.debug("  POSTGRES ▸ REFLECTION LIST_RECENT | limit=%d", limit)
        result = await self._session.execute(
            select(ReflectionTable).order_by(ReflectionTable.created_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ REFLECTION LIST_RECENT | returned %d rows", len(rows))
        return [
            Reflection(
                id=row.id,
                created_at=row.created_at,
                trigger=row.trigger,
                summary=row.summary,
                patterns_identified=row.patterns_identified or [],
                suggestions=row.suggestions or [],
                related_objective_ids=row.related_objective_ids or [],
                related_learning_ids=row.related_learning_ids or [],
            )
            for row in rows
        ]


class PostgresChatHistoryRepository(ChatHistoryRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save_message(self, message: ChatMessageRecord) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ CHAT MESSAGE SAVE ═══════════════════════════\n"
            "║  ID          : %s\n"
            "║  Session ID  : %s\n"
            "║  Role        : %s\n"
            "║  Content     : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            message.id, message.session_id, message.role,
            (message.content[:60] + "…") if len(message.content) > 60 else message.content,
        )
        row = ChatMessageTable(
            id=message.id,
            session_id=message.session_id,
            role=message.role,
            content=message.content,
            context_used=message.context_used,
            sources=message.sources,
            created_at=message.created_at,
        )
        self._session.add(row)
        await self._session.commit()

    async def get_message(self, message_id: str) -> Optional[ChatMessageRecord]:
        logger.debug("  POSTGRES ▸ CHAT MESSAGE GET | ID: %s", message_id)
        result = await self._session.execute(
            select(ChatMessageTable).where(ChatMessageTable.id == message_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning("  POSTGRES ▸ CHAT MESSAGE GET | NOT FOUND: %s", message_id)
            return None
        return ChatMessageRecord(
            id=row.id,
            session_id=row.session_id,
            role=row.role,
            content=row.content,
            context_used=row.context_used,
            sources=row.sources,
            created_at=row.created_at,
        )

    async def list_messages_by_session(self, session_id: str) -> List[ChatMessageRecord]:
        logger.debug("  POSTGRES ▸ CHAT MESSAGE LIST_BY_SESSION | session_id: %s", session_id)
        result = await self._session.execute(
            select(ChatMessageTable).where(ChatMessageTable.session_id == session_id)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ CHAT MESSAGE LIST_BY_SESSION | returned %d rows", len(rows))
        return [
            ChatMessageRecord(
                id=row.id,
                session_id=row.session_id,
                role=row.role,
                content=row.content,
                context_used=row.context_used,
                sources=row.sources,
                created_at=row.created_at,
            )
            for row in rows
        ]

    async def save_session(self, session: ChatSession) -> None:
        logger.info(
            "\n╔══ POSTGRES ▸ CHAT SESSION SAVE ═══════════════════════════\n"
            "║  ID     : %s\n"
            "║  Title  : %s\n"
            "╚══════════════════════════════════════════════════════════\n",
            session.id, session.title,
        )
        row = ChatSessionTable(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=session.message_count,
        )
        self._session.add(row)
        await self._session.commit()

    async def get_session(self, session_id: str) -> Optional[ChatSession]:
        logger.debug("  POSTGRES ▸ CHAT SESSION GET | ID: %s", session_id)
        result = await self._session.execute(
            select(ChatSessionTable).where(ChatSessionTable.id == session_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            logger.warning("  POSTGRES ▸ CHAT SESSION GET | NOT FOUND: %s", session_id)
            return None
        return ChatSession(
            id=row.id,
            title=row.title,
            created_at=row.created_at,
            updated_at=row.updated_at,
            message_count=row.message_count,
        )

    async def list_sessions(self, limit: int = 20) -> List[ChatSession]:
        logger.debug("  POSTGRES ▸ CHAT SESSION LIST | limit=%d", limit)
        result = await self._session.execute(
            select(ChatSessionTable).order_by(ChatSessionTable.updated_at.desc()).limit(limit)
        )
        rows = result.scalars().all()
        logger.debug("  POSTGRES ▸ CHAT SESSION LIST | returned %d rows", len(rows))
        return [
            ChatSession(
                id=row.id,
                title=row.title,
                created_at=row.created_at,
                updated_at=row.updated_at,
                message_count=row.message_count,
            )
            for row in rows
        ]

    async def create_session(self, session: ChatSession) -> None:
        await self.save_session(session)

    async def get_session_messages(self, session_id: str, limit: int = 50) -> List[ChatMessageRecord]:
        logger.debug("  POSTGRES ▸ CHAT MESSAGES | session=%s limit=%d", session_id, limit)
        result = await self._session.execute(
            select(ChatMessageTable)
            .where(ChatMessageTable.session_id == session_id)
            .order_by(ChatMessageTable.created_at.asc())
            .limit(limit)
        )
        rows = result.scalars().all()
        return [
            ChatMessageRecord(
                id=row.id,
                session_id=row.session_id,
                role=row.role,
                content=row.content,
                context_used=row.context_used,
                sources=row.sources or [],
                created_at=row.created_at,
            )
            for row in rows
        ]

    async def update_session(self, session: ChatSession) -> None:
        result = await self._session.execute(
            select(ChatSessionTable).where(ChatSessionTable.id == session.id)
        )
        row = result.scalar_one_or_none()
        if row:
            row.title = session.title
            row.updated_at = session.updated_at
            row.message_count = session.message_count
            await self._session.commit()

    async def delete_session(self, session_id: str) -> None:
        # Delete messages first
        from sqlalchemy import delete as sql_delete
        await self._session.execute(
            sql_delete(ChatMessageTable).where(ChatMessageTable.session_id == session_id)
        )
        await self._session.execute(
            sql_delete(ChatSessionTable).where(ChatSessionTable.id == session_id)
        )
        await self._session.commit()
        logger.info("  POSTGRES ▸ CHAT SESSION DELETED | id=%s", session_id)
