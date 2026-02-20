import logging
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from backend.interface import (
    IngestTextRequest,
    IngestResponse,
    StatusResponse,
    ApprovalRequest,
    ObjectiveResponse,
    ProgressRequest,
    ProgressResponse,
    CaptureLearningRequest,
    LearningResponse,
    LogDecisionRequest,
    DecisionResponse,
    ReflectionRequest,
    ReflectionResponse,
    SearchRequest,
    SearchResult,
    ChatRequest,
    ChatResponse,
    ChatSessionResponse,
    ChatHistoryResponse,
)
from backend.infrastructure.database import get_db_session
from backend.application.container import (
    get_ingest_use_case,
    get_confirm_plan_use_case,
    get_update_progress_use_case,
    get_query_use_case,
    get_learning_use_case,
    get_decision_use_case,
    get_reflection_use_case,
    get_search_use_case,
    get_chat_use_case,
    get_chat_use_case_with_history,
    get_chat_history_repo,
    get_insight_agent_instance,
    get_objective_repo,
    get_learning_repo,
    get_decision_repo,
    get_reflection_repo,
)
from typing import List

logger = logging.getLogger("jarvis.api")

router = APIRouter(prefix="/api/v1", tags=["jarvis"])


# ═══════════════════════════════════════════════════════════════════
# OBJECTIVES (original, enhanced)
# ═══════════════════════════════════════════════════════════════════
@router.post("/ingest/text", response_model=IngestResponse, status_code=202)
async def ingest_text(body: IngestTextRequest):
    logger.info(
        "\n╔══ API ▸ POST /ingest/text ═══════════════════════════════\n"
        "║  Text preview : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        (body.text[:80] + "…") if len(body.text) > 80 else body.text,
    )
    use_case = await get_ingest_use_case()
    objective_id = await use_case.execute(text=body.text)
    logger.info("  API ▸ RESPONSE 202 | objective_id=%s", objective_id)
    return IngestResponse(objective_id=objective_id, status="processing")


@router.post("/ingest/file", response_model=IngestResponse, status_code=202)
async def ingest_file(file: UploadFile = File(...)):
    logger.info(
        "\n╔══ API ▸ POST /ingest/file ═══════════════════════════════\n"
        "║  Filename : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        file.filename,
    )
    content = await file.read()
    use_case = await get_ingest_use_case()
    objective_id = await use_case.execute(file_content=content, filename=file.filename)
    logger.info("  API ▸ RESPONSE 202 | objective_id=%s", objective_id)
    return IngestResponse(objective_id=objective_id, status="processing")


@router.get("/objectives/{objective_id}/status", response_model=StatusResponse)
async def get_status(objective_id: str, session: AsyncSession = Depends(get_db_session)):
    logger.info("  API ▸ GET /objectives/%s/status", objective_id)
    use_case = await get_query_use_case(session)
    result = await use_case.get_staging_status(objective_id)
    if result.get("status") == "not_found":
        logger.warning("  API ▸ 404 | Objective not found: %s", objective_id)
        raise HTTPException(status_code=404, detail="Objective not found")
    logger.info("  API ▸ RESPONSE 200 | status=%s source=%s", result["status"], result.get("source", "unknown"))
    return StatusResponse(
        objective_id=objective_id,
        status=result["status"],
        source=result.get("source", "unknown"),
        objective=result.get("objective"),
        plan_draft=result.get("plan_draft"),
    )


@router.post("/objectives/{objective_id}/confirm", response_model=ObjectiveResponse)
async def confirm_plan(
    objective_id: str,
    body: ApprovalRequest,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info(
        "\n╔══ API ▸ POST /objectives/%s/confirm ═════════════════════\n"
        "║  Approved : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        objective_id, body.approved,
    )
    use_case = await get_confirm_plan_use_case(session)
    try:
        objective = await use_case.execute(
            objective_id=objective_id,
            approved=body.approved,
            modifications=body.modifications,
        )
    except ValueError as e:
        logger.error("  API ▸ 400 | %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error("  API ▸ 500 | %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    logger.info("  API ▸ RESPONSE 200 | objective=%s status=%s", objective.id, objective.status)
    return ObjectiveResponse(
        id=objective.id,
        what=objective.what,
        why=objective.why,
        context=objective.context,
        expected_output=objective.expected_output,
        status=objective.status,
        workdone=objective.workdone,
        plan=objective.plan,
        tags=objective.tags,
        created_at=objective.created_at.isoformat() if objective.created_at else None,
    )


@router.post("/objectives/{objective_id}/progress", response_model=ProgressResponse)
async def update_progress(
    objective_id: str,
    body: ProgressRequest,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ POST /objectives/%s/progress | step=%d", objective_id, body.completed_step)
    use_case = await get_update_progress_use_case(session)
    try:
        objective = await use_case.execute(objective_id, body.completed_step)
    except ValueError as e:
        logger.error("  API ▸ 400 | %s", e)
        raise HTTPException(status_code=400, detail=str(e))

    completed = sum(1 for s in (objective.plan or []) if s.status == "completed")
    total = len(objective.plan or [])
    logger.info("  API ▸ RESPONSE 200 | progress=%d/%d workdone=%d%%", completed, total, objective.workdone)

    return ProgressResponse(
        objective_id=objective.id,
        workdone=objective.workdone,
        status=objective.status,
        completed_steps=completed,
        total_steps=total,
    )


@router.get("/objectives/{objective_id}", response_model=ObjectiveResponse)
async def get_objective(
    objective_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /objectives/%s", objective_id)
    use_case = await get_query_use_case(session)
    objective = await use_case.get_objective(objective_id)
    if not objective:
        logger.warning("  API ▸ 404 | Objective not found: %s", objective_id)
        raise HTTPException(status_code=404, detail="Objective not found")
    logger.info("  API ▸ RESPONSE 200 | objective=%s status=%s", objective.id, objective.status)
    return ObjectiveResponse(
        id=objective.id,
        what=objective.what,
        why=objective.why,
        context=objective.context,
        expected_output=objective.expected_output,
        status=objective.status,
        workdone=objective.workdone,
        plan=objective.plan,
        tags=objective.tags,
        created_at=objective.created_at.isoformat() if objective.created_at else None,
    )


@router.get("/objectives", response_model=List[ObjectiveResponse])
async def list_objectives(
    limit: int = 20,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /objectives | limit=%d", limit)
    use_case = await get_query_use_case(session)
    objectives = await use_case.list_recent(limit)
    logger.info("  API ▸ RESPONSE 200 | returned %d objectives", len(objectives))
    return [
        ObjectiveResponse(
            id=o.id,
            what=o.what,
            why=o.why,
            context=o.context,
            expected_output=o.expected_output,
            status=o.status,
            workdone=o.workdone,
            plan=o.plan,
            tags=o.tags,
            created_at=o.created_at.isoformat() if o.created_at else None,
        )
        for o in objectives
    ]


# ═══════════════════════════════════════════════════════════════════
# LEARNINGS
# ═══════════════════════════════════════════════════════════════════
@router.post("/learnings", response_model=LearningResponse, status_code=201)
async def capture_learning(
    body: CaptureLearningRequest,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info(
        "\n╔══ API ▸ POST /learnings ═════════════════════════════════\n"
        "║  Category : %s\n"
        "║  Tags     : %s\n"
        "║  Content  : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        body.category,
        ", ".join(body.tags) if body.tags else "(none)",
        (body.content[:60] + "…") if len(body.content) > 60 else body.content,
    )
    use_case = await get_learning_use_case(session)
    learning = await use_case.execute(
        content=body.content,
        category=body.category,
        tags=body.tags,
        source_objective_id=body.source_objective_id,
    )
    logger.info("  API ▸ RESPONSE 201 | learning_id=%s", learning.id)
    return LearningResponse(
        id=learning.id,
        content=learning.content,
        category=learning.category.value,
        tags=learning.tags,
        source_objective_id=learning.source_objective_id,
        confidence=learning.confidence,
        created_at=learning.created_at.isoformat(),
    )


@router.get("/learnings", response_model=List[LearningResponse])
async def list_learnings(
    limit: int = 20,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /learnings | limit=%d", limit)
    repo = await get_learning_repo(session)
    learnings = await repo.list_recent(limit)
    logger.info("  API ▸ RESPONSE 200 | returned %d learnings", len(learnings))
    return [
        LearningResponse(
            id=l.id,
            content=l.content,
            category=l.category.value,
            tags=l.tags,
            source_objective_id=l.source_objective_id,
            confidence=l.confidence,
            created_at=l.created_at.isoformat(),
        )
        for l in learnings
    ]


# ═══════════════════════════════════════════════════════════════════
# DECISIONS
# ═══════════════════════════════════════════════════════════════════
@router.post("/decisions", response_model=DecisionResponse, status_code=201)
async def log_decision(
    body: LogDecisionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info(
        "\n╔══ API ▸ POST /decisions ═════════════════════════════════\n"
        "║  Decision : %s\n"
        "║  Tags     : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        (body.decision[:60] + "…") if len(body.decision) > 60 else body.decision,
        ", ".join(body.tags) if body.tags else "(none)",
    )
    use_case = await get_decision_use_case(session)
    decision = await use_case.execute(
        decision=body.decision,
        why=body.why,
        context=body.context,
        alternatives_considered=body.alternatives_considered,
        expected_outcome=body.expected_outcome,
        tags=body.tags,
        source_objective_id=body.source_objective_id,
    )
    logger.info("  API ▸ RESPONSE 201 | decision_id=%s", decision.id)
    return DecisionResponse(
        id=decision.id,
        decision=decision.decision,
        why=decision.why,
        context=decision.context,
        alternatives_considered=decision.alternatives_considered,
        expected_outcome=decision.expected_outcome,
        tags=decision.tags,
        created_at=decision.created_at.isoformat(),
    )


@router.get("/decisions", response_model=List[DecisionResponse])
async def list_decisions(
    limit: int = 20,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /decisions | limit=%d", limit)
    repo = await get_decision_repo(session)
    decisions = await repo.list_recent(limit)
    logger.info("  API ▸ RESPONSE 200 | returned %d decisions", len(decisions))
    return [
        DecisionResponse(
            id=d.id,
            decision=d.decision,
            why=d.why,
            context=d.context,
            alternatives_considered=d.alternatives_considered,
            expected_outcome=d.expected_outcome,
            tags=d.tags,
            created_at=d.created_at.isoformat(),
        )
        for d in decisions
    ]


# ═══════════════════════════════════════════════════════════════════
# REFLECTIONS
# ═══════════════════════════════════════════════════════════════════
@router.post("/reflect", response_model=ReflectionResponse, status_code=201)
async def create_reflection(
    body: ReflectionRequest,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info(
        "\n╔══ API ▸ POST /reflect ═══════════════════════════════════\n"
        "║  Trigger : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        (body.trigger[:80] + "…") if len(body.trigger) > 80 else body.trigger,
    )
    use_case = await get_reflection_use_case(session)
    reflection = await use_case.execute(trigger=body.trigger)
    logger.info("  API ▸ RESPONSE 201 | reflection_id=%s", reflection.id)
    return ReflectionResponse(
        id=reflection.id,
        trigger=reflection.trigger,
        summary=reflection.summary,
        patterns_identified=reflection.patterns_identified,
        suggestions=reflection.suggestions,
        created_at=reflection.created_at.isoformat(),
    )


@router.get("/reflections", response_model=List[ReflectionResponse])
async def list_reflections(
    limit: int = 10,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /reflections | limit=%d", limit)
    repo = await get_reflection_repo(session)
    reflections = await repo.list_recent(limit)
    logger.info("  API ▸ RESPONSE 200 | returned %d reflections", len(reflections))
    return [
        ReflectionResponse(
            id=r.id,
            trigger=r.trigger,
            summary=r.summary,
            patterns_identified=r.patterns_identified,
            suggestions=r.suggestions,
            created_at=r.created_at.isoformat(),
        )
        for r in reflections
    ]


# ═══════════════════════════════════════════════════════════════════
# SEMANTIC SEARCH
# ═══════════════════════════════════════════════════════════════════
@router.post("/search", response_model=List[SearchResult])
async def semantic_search_route(body: SearchRequest):
    logger.info(
        "\n╔══ API ▸ POST /search ════════════════════════════════════\n"
        "║  Query : %s\n"
        "║  Limit : %d\n"
        "╚══════════════════════════════════════════════════════════\n",
        (body.query[:80] + "…") if len(body.query) > 80 else body.query,
        body.limit,
    )
    use_case = await get_search_use_case()
    results = await use_case.execute(query=body.query, limit=body.limit)
    logger.info("  API ▸ RESPONSE 200 | returned %d search results", len(results))
    return [
        SearchResult(
            id=str(r.get("id", "")),
            score=r.get("score", 0.0),
            payload=r.get("payload", {}),
        )
        for r in results
    ]


# ═══════════════════════════════════════════════════════════════════
# AUTO-EXTRACT LEARNINGS FROM COMPLETED OBJECTIVE
# ═══════════════════════════════════════════════════════════════════
@router.post("/objectives/{objective_id}/extract-learnings", response_model=List[LearningResponse])
async def extract_learnings(
    objective_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info(
        "\n╔══ API ▸ POST /objectives/%s/extract-learnings ══════════\n"
        "╚══════════════════════════════════════════════════════════\n",
        objective_id,
    )
    obj_repo = await get_objective_repo(session)
    objective = await obj_repo.get(objective_id)
    if not objective:
        logger.warning("  API ▸ 404 | Objective not found: %s", objective_id)
        raise HTTPException(status_code=404, detail="Objective not found")

    insight_agent = await get_insight_agent_instance()
    learnings = await insight_agent.extract_learnings(objective)

    learning_uc = await get_learning_use_case(session)
    saved = await learning_uc.save_batch(learnings)
    logger.info("  API ▸ RESPONSE 200 | extracted & saved %d learnings", len(saved))

    return [
        LearningResponse(
            id=l.id,
            content=l.content,
            category=l.category.value,
            tags=l.tags,
            source_objective_id=l.source_objective_id,
            confidence=l.confidence,
            created_at=l.created_at.isoformat(),
        )
        for l in saved
    ]


# ═══════════════════════════════════════════════════════════════════
# CHAT (main conversational interface — persistent)
# ═══════════════════════════════════════════════════════════════════
@router.post("/chat", response_model=ChatResponse)
async def chat_route(body: ChatRequest, session: AsyncSession = Depends(get_db_session)):
    logger.info(
        "\n╔══ API ▸ POST /chat ══════════════════════════════════════\n"
        "║  Message    : %s\n"
        "║  Session ID : %s\n"
        "╚══════════════════════════════════════════════════════════\n",
        (body.message[:80] + "…") if len(body.message) > 80 else body.message,
        body.session_id or "(new)",
    )
    use_case = await get_chat_use_case_with_history(session)
    history = [{"role": m.role, "content": m.content} for m in (body.history or [])]
    result = await use_case.execute(
        message=body.message,
        session_id=body.session_id,
        history=history,
    )
    logger.info("  API ▸ RESPONSE 200 | reply_len=%d context=%d session=%s",
                len(result["reply"]), result["context_used"], result.get("session_id"))
    return ChatResponse(**result)


@router.get("/chat/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    limit: int = 20,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /chat/sessions | limit=%d", limit)
    repo = await get_chat_history_repo(session)
    sessions = await repo.list_sessions(limit)
    return [
        ChatSessionResponse(
            id=s.id,
            title=s.title,
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
            message_count=s.message_count,
        )
        for s in sessions
    ]


@router.get("/chat/sessions/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ GET /chat/sessions/%s", session_id)
    repo = await get_chat_history_repo(session)
    messages = await repo.get_session_messages(session_id, limit=100)
    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "context_used": m.context_used,
                "sources": m.sources,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    )


@router.delete("/chat/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    session: AsyncSession = Depends(get_db_session),
):
    logger.info("  API ▸ DELETE /chat/sessions/%s", session_id)
    repo = await get_chat_history_repo(session)
    await repo.delete_session(session_id)
    return {"status": "deleted", "session_id": session_id}


# ═══════════════════════════════════════════════════════════════════
# DASHBOARD SUMMARY
# ═══════════════════════════════════════════════════════════════════
@router.get("/dashboard")
async def dashboard_summary(session: AsyncSession = Depends(get_db_session)):
    logger.info("  API ▸ GET /dashboard")
    obj_repo = await get_objective_repo(session)
    learn_repo = await get_learning_repo(session)
    dec_repo = await get_decision_repo(session)
    ref_repo = await get_reflection_repo(session)

    objectives = await obj_repo.list_recent(5)
    learnings = await learn_repo.list_recent(5)
    decisions = await dec_repo.list_recent(5)
    reflections = await ref_repo.list_recent(5)

    return {
        "objectives": [
            {"id": o.id, "what": o.what, "status": o.status.value, "workdone": o.workdone, "tags": o.tags}
            for o in objectives
        ],
        "learnings": [
            {"id": l.id, "content": l.content[:120], "category": l.category.value, "tags": l.tags}
            for l in learnings
        ],
        "decisions": [
            {"id": d.id, "decision": d.decision[:120], "why": d.why[:80], "tags": d.tags}
            for d in decisions
        ],
        "reflections": [
            {"id": r.id, "trigger": r.trigger[:80], "patterns": len(r.patterns_identified), "suggestions": len(r.suggestions)}
            for r in reflections
        ],
        "counts": {
            "objectives": len(objectives),
            "learnings": len(learnings),
            "decisions": len(decisions),
            "reflections": len(reflections),
        },
    }
