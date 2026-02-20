"""
Chat use case — persistent, context-aware conversational AI.
Always surfaces learnings from past failures, decisions, and reflections.
Persists all conversations to Postgres for cross-session memory.
"""

import logging
from datetime import datetime
from typing import List, Dict, Optional
from groq import AsyncGroq
from backend.ports.interfaces import (
    VectorStore, EmbeddingProvider, ChatHistoryRepository,
    LearningRepository, DecisionLogRepository,
)
from backend.domain.models import (
    ChatMessageRecord, ChatSession,
    Learning, LearningCategory, DecisionLog,
)
from backend.application.auto_capture_use_case import AutoCaptureUseCase
from backend.config import get_settings

logger = logging.getLogger("jarvis.usecase.chat")

JARVIS_SYSTEM_PROMPT = """You are JARVIS, a deeply personal business assistant for a solo business owner.

YOUR CORE MISSION:
You are not just a chatbot — you are a thinking partner, memory keeper, and accountability buddy.
You remember every conversation, every learning, every failure, and every decision shared with you.

HOW YOU BEHAVE:
1. ALWAYS reference specific past learnings, failures, and decisions when relevant
2. If the user is about to repeat a past mistake, PROACTIVELY warn them
3. Surface patterns you've noticed across their journey
4. Be concise, warm, and actionable — never generic
5. When giving advice, ground it in the user's own experiences and context
6. If you notice a pattern of repeated failures, say so directly but supportively
7. Celebrate wins and progress, reference how far they've come
8. Ask clarifying questions when the request is ambiguous

YOUR KNOWLEDGE BASE includes:
- Objectives (goals/projects with their status and progress)
- Learnings (insights, mistakes, successes, patterns, tool tips, process improvements)
- Decisions (what was decided, why, alternatives considered, outcomes)
- Reflections (periodic thinking summaries, patterns, suggestions)
- Previous conversations (you remember what was discussed before)

IMPORTANT RULES:
- If you find past mistakes/failures relevant to the current topic, ALWAYS mention them
- Start responses with the most important/actionable point
- Use bullet points for clarity
- If no relevant context is found, be honest about it
- Never make up past events — only reference what's in your context

IMPLEMENTATION PLAN FORMAT:
When the user asks for a plan, strategy, roadmap, implementation steps, how to achieve something,
or any task that involves multiple steps or phases, you MUST ALWAYS structure your response 
using this EXACT format. This is critical — the UI depends on this format to render a visual plan tracker.

You may include a brief 1-2 sentence intro before the phases, but then MUST use this exact structure:

Phase 1: [Short Phase Title]
- First subtask or action item
- Second subtask or action item
- Use ✅ prefix for items already completed

Phase 2: [Short Phase Title]
- Action item here
- Another action item

Phase 3: [Short Phase Title]
- Action item here
- Another action item

STRICT RULES FOR PLANS:
- ALWAYS use "Phase 1:", "Phase 2:", etc. — NEVER use "Step 1:", "Week 1:", or any other format
- Use exactly 3-6 phases, each with 2-5 bullet point subtasks starting with "- "
- Phase titles must be short (3-6 words max)
- Each bullet must start with "- " (dash space)
- Mark completed items with "✅ " prefix
- Mark in-progress items with "🔄 " prefix  
- If the user has already done something based on context, mark those phases/items as ✅
- After all phases, you may add a brief closing sentence
- NEVER use numbered lists (1. 2. 3.) inside phases — only dash bullets

{context_block}

{history_context}"""


class ChatUseCase:
    """Persistent chat interface with cross-session memory, proactive learning surfacing, and auto-capture."""

    def __init__(
        self,
        vector_store: VectorStore,
        embedding: EmbeddingProvider,
        chat_repo: Optional[ChatHistoryRepository] = None,
        learning_repo: Optional[LearningRepository] = None,
        decision_repo: Optional[DecisionLogRepository] = None,
    ):
        self._vector_store = vector_store
        self._embedding = embedding
        self._chat_repo = chat_repo
        self._learning_repo = learning_repo
        self._decision_repo = decision_repo
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)
        self._auto_capture = AutoCaptureUseCase()

    async def execute(
        self,
        message: str,
        session_id: Optional[str] = None,
        history: Optional[List[Dict]] = None,
    ) -> Dict:
        logger.info("[CHAT] User (session=%s): '%s'", session_id, message[:120])

        # 1. Load persistent history for this session
        persistent_history = []
        if session_id and self._chat_repo:
            try:
                past_messages = await self._chat_repo.get_session_messages(session_id, limit=20)
                persistent_history = [
                    {"role": m.role, "content": m.content}
                    for m in past_messages
                ]
                logger.info("[CHAT] Loaded %d messages from session %s", len(persistent_history), session_id)
            except Exception as e:
                logger.warning("[CHAT] Could not load session history: %s", e)

        # 2. Retrieve relevant context via semantic search (more items for richer context)
        query_emb = await self._embedding.embed(message)
        context_results = await self._vector_store.search(query_emb, limit=8)

        # 3. Specifically search for failures/mistakes to always surface them
        failure_query = f"mistake failure lesson learned from {message}"
        failure_emb = await self._embedding.embed(failure_query)
        failure_results = await self._vector_store.search(failure_emb, limit=4)

        # Merge and deduplicate results
        seen_ids = set()
        all_results = []
        for r in context_results + failure_results:
            rid = r.get("id", "")
            if rid not in seen_ids:
                seen_ids.add(rid)
                all_results.append(r)

        # 4. Build rich context block
        context_block = self._build_context(all_results)
        logger.info("[CHAT] Retrieved %d unique context items (including failure search).", len(all_results))

        # 5. Build history context summary from past conversations
        history_context = ""
        if persistent_history:
            recent_summary = self._summarize_recent_history(persistent_history[-10:])
            history_context = f"\n--- RECENT CONVERSATION HISTORY ---\n{recent_summary}\n--- END HISTORY ---"

        # 6. Build messages for Groq
        system_content = JARVIS_SYSTEM_PROMPT.format(
            context_block=f"\n--- RETRIEVED KNOWLEDGE BASE ---\n{context_block}\n--- END KNOWLEDGE BASE ---",
            history_context=history_context,
        )

        messages = [{"role": "system", "content": system_content}]

        # Add conversation history (persistent + current session)
        combined_history = persistent_history or []
        if history:
            for turn in history[-10:]:
                combined_history.append({
                    "role": turn.get("role", "user"),
                    "content": turn.get("content", ""),
                })

        # Only use last 10 turns to stay within context window
        for turn in combined_history[-10:]:
            messages.append({
                "role": turn["role"],
                "content": turn["content"],
            })

        messages.append({"role": "user", "content": message})

        # 7. Call Groq LLM
        logger.info("[CHAT] Calling Groq LLM (model=llama-3.3-70b-versatile)...")
        response = await self._client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=1500,
            messages=messages,
        )

        reply = response.choices[0].message.content
        logger.info("[CHAT] Reply (%d chars): '%s'", len(reply), reply[:100])

        # 8. Build sources list
        sources = [
            {
                "type": r.get("payload", {}).get("_type", "unknown"),
                "score": round(r.get("score", 0), 3),
                "preview": self._preview(r.get("payload", {})),
            }
            for r in all_results[:5]
        ]

        # 9. Persist messages to Postgres
        if session_id and self._chat_repo:
            try:
                # Check if session exists, create if not
                existing_session = await self._chat_repo.get_session(session_id)
                if not existing_session:
                    title = message[:60] + ("…" if len(message) > 60 else "")
                    new_session = ChatSession(
                        id=session_id,
                        title=title,
                        message_count=0,
                    )
                    await self._chat_repo.create_session(new_session)
                    existing_session = new_session

                # Save user message
                user_msg = ChatMessageRecord(
                    session_id=session_id,
                    role="user",
                    content=message,
                )
                await self._chat_repo.save_message(user_msg)

                # Save assistant reply
                assistant_msg = ChatMessageRecord(
                    session_id=session_id,
                    role="assistant",
                    content=reply,
                    context_used=len(all_results),
                    sources=sources,
                )
                await self._chat_repo.save_message(assistant_msg)

                # Update session metadata
                existing_session.updated_at = datetime.utcnow()
                existing_session.message_count += 2
                if existing_session.message_count == 2:
                    existing_session.title = message[:60] + ("…" if len(message) > 60 else "")
                await self._chat_repo.update_session(existing_session)

                logger.info("[CHAT] Persisted messages for session %s", session_id)
            except Exception as e:
                logger.error("[CHAT] Failed to persist chat: %s", e)

        # 10. Auto-capture learnings, decisions, objectives from message
        auto_captured = []
        try:
            extracted = await self._auto_capture.detect_and_extract(message, reply)
            for item in extracted:
                saved_item = await self._save_captured_item(item)
                if saved_item:
                    auto_captured.append(saved_item)
            if auto_captured:
                logger.info("[CHAT] Auto-captured %d items: %s",
                            len(auto_captured), [i["type"] for i in auto_captured])
        except Exception as e:
            logger.warning("[CHAT] Auto-capture failed (non-fatal): %s", e)

        return {
            "reply": reply,
            "context_used": len(all_results),
            "sources": sources,
            "session_id": session_id,
            "auto_captured": auto_captured,
        }

    async def _save_captured_item(self, item: Dict) -> Optional[Dict]:
        """Save an auto-captured item to the appropriate repo + vector store."""
        import asyncio
        item_type = item.get("type")

        try:
            if item_type == "learning" and self._learning_repo:
                cat_str = item.get("category", "insight")
                try:
                    category = LearningCategory(cat_str)
                except ValueError:
                    category = LearningCategory.INSIGHT

                learning = Learning(
                    content=item.get("content", ""),
                    category=category,
                    tags=item.get("tags", []),
                )
                emb = await self._embedding.embed(learning.embedding_text())
                payload = learning.model_dump(mode="json")
                payload["_type"] = "learning"

                await asyncio.gather(
                    self._learning_repo.save(learning),
                    self._vector_store.upsert(learning.id, emb, payload),
                    return_exceptions=True,
                )
                logger.info("[AUTOCAPTURE] Saved learning: %s [%s]", learning.id, category.value)
                return {
                    "type": "learning",
                    "id": learning.id,
                    "content": learning.content,
                    "category": category.value,
                    "tags": learning.tags,
                }

            elif item_type == "decision" and self._decision_repo:
                decision = DecisionLog(
                    decision=item.get("decision", ""),
                    why=item.get("why", "") or "Captured from conversation",
                    context=item.get("context", "") or "Auto-captured from chat",
                    expected_outcome=item.get("expected_outcome", "") or "",
                    tags=item.get("tags", []),
                )
                emb = await self._embedding.embed(decision.embedding_text())
                payload = decision.model_dump(mode="json")
                payload["_type"] = "decision"

                await asyncio.gather(
                    self._decision_repo.save(decision),
                    self._vector_store.upsert(decision.id, emb, payload),
                    return_exceptions=True,
                )
                logger.info("[AUTOCAPTURE] Saved decision: %s", decision.id)
                return {
                    "type": "decision",
                    "id": decision.id,
                    "decision": decision.decision,
                    "tags": decision.tags,
                }

            elif item_type == "objective":
                # Return as a suggestion; objectives need user confirmation
                return {
                    "type": "objective_suggestion",
                    "text": item.get("text", ""),
                    "tags": item.get("tags", []),
                }

        except Exception as e:
            logger.warning("[AUTOCAPTURE] Failed to save %s: %s", item_type, e)
            return None

        return None

    @staticmethod
    def _build_context(results: List[Dict]) -> str:
        if not results:
            return "No prior knowledge found. This appears to be a fresh start — no objectives, learnings, or decisions recorded yet."

        parts = []
        failures = []
        for i, r in enumerate(results, 1):
            payload = r.get("payload", {})
            item_type = payload.get("_type", "unknown")
            score = r.get("score", 0)

            if item_type == "objective":
                status = payload.get('status', 'N/A')
                entry = (
                    f"{i}. [Objective] (relevance: {score:.2f})\n"
                    f"   What: {payload.get('what', 'N/A')}\n"
                    f"   Status: {status}\n"
                    f"   Progress: {payload.get('workdone', 0)}%"
                )
                parts.append(entry)
                if status == "failed":
                    failures.append(f"⚠️ FAILED OBJECTIVE: {payload.get('what', 'N/A')}")

            elif item_type == "learning":
                category = payload.get('category', '?')
                entry = (
                    f"{i}. [Learning/{category}] (relevance: {score:.2f})\n"
                    f"   {payload.get('content', 'N/A')}"
                )
                parts.append(entry)
                if category in ("mistake", "pattern"):
                    failures.append(f"📝 PAST {category.upper()}: {payload.get('content', 'N/A')[:120]}")

            elif item_type == "decision":
                parts.append(
                    f"{i}. [Decision] (relevance: {score:.2f})\n"
                    f"   {payload.get('decision', 'N/A')}\n"
                    f"   Why: {payload.get('why', 'N/A')}"
                )

            elif item_type == "reflection":
                parts.append(
                    f"{i}. [Reflection] (relevance: {score:.2f})\n"
                    f"   {payload.get('summary', 'N/A')[:200]}"
                )
            else:
                parts.append(f"{i}. [{item_type}] (relevance: {score:.2f})")

        # Highlight failures/mistakes prominently
        if failures:
            parts.insert(0, "🔴 IMPORTANT — PAST FAILURES & LESSONS TO REMEMBER:\n" + "\n".join(failures) + "\n")

        return "\n\n".join(parts)

    @staticmethod
    def _summarize_recent_history(history: List[Dict]) -> str:
        parts = []
        for msg in history:
            role = msg.get("role", "unknown").capitalize()
            content = msg.get("content", "")[:200]
            parts.append(f"[{role}]: {content}")
        return "\n".join(parts)

    @staticmethod
    def _preview(payload: Dict) -> str:
        for key in ("what", "content", "decision", "summary", "trigger"):
            if key in payload:
                val = str(payload[key])
                return val[:80] + "…" if len(val) > 80 else val
        return "—"
