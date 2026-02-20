import json
import logging
from typing import List
from groq import AsyncGroq
from backend.ports.interfaces import StructuringAgent, PlanningAgent, ReflectionAgent, InsightAgent
from backend.domain.models import Objective, PlanStep, Learning, LearningCategory, Reflection
from backend.config import get_settings

logger = logging.getLogger("jarvis.infra.groq")


class GroqStructuringAgent(StructuringAgent):
    def __init__(self):
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)
        logger.info("[GROQ] StructuringAgent initialized.")

    async def structure(self, raw_text: str) -> Objective:
        logger.info("[GROQ] Structuring input (%d chars)...", len(raw_text))

        response = await self._client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are JARVIS, a personal business assistant. "
                        "Extract structured data from user input. "
                        "Return JSON with keys: "
                        '"what" (core task/objective), '
                        '"why" (motivation/reasoning or null), '
                        '"context" (background/constraints/current situation), '
                        '"expected_output" (deliverable/desired result), '
                        '"tags" (list of 2-5 relevant topic tags).'
                    ),
                },
                {"role": "user", "content": raw_text},
            ],
        )

        parsed = json.loads(response.choices[0].message.content)
        logger.info("[GROQ] Structured result: what='%s', tags=%s", parsed.get("what", "")[:60], parsed.get("tags", []))

        return Objective(
            what=parsed.get("what", raw_text[:200]),
            why=parsed.get("why"),
            context=parsed.get("context", ""),
            expected_output=parsed.get("expected_output", ""),
            tags=parsed.get("tags", []),
        )


class GroqPlanningAgent(PlanningAgent):
    def __init__(self):
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)
        logger.info("[GROQ] PlanningAgent initialized.")

    async def draft_plan(self, objective: Objective) -> List[PlanStep]:
        logger.info("[GROQ] Drafting plan for: '%s'", objective.what[:60])

        response = await self._client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are JARVIS, a personal business assistant. "
                        "Create an execution plan for a solo business owner. "
                        "Return JSON with key 'steps' "
                        "containing an array of objects with: "
                        "'step_number' (int), 'description' (str), "
                        "'weight' (float, relative effort 0.1-10.0). "
                        "Minimum 3, maximum 10 steps. "
                        "Weight reflects real effort — a research step might be 1.0, "
                        "a complex implementation step might be 8.0. "
                        "Steps must be concrete and independently verifiable. "
                        "Think from the perspective of a single person managing everything."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Task: {objective.what}\n"
                        f"Context: {objective.context}\n"
                        f"Expected Output: {objective.expected_output}\n"
                        f"Why: {objective.why or 'Not specified'}"
                    ),
                },
            ],
        )

        parsed = json.loads(response.choices[0].message.content)
        steps = parsed.get("steps", [])
        result = [
            PlanStep(
                step_number=s["step_number"],
                description=s["description"],
                weight=float(s.get("weight", 1.0)),
            )
            for s in steps[:10]
        ]
        logger.info("[GROQ] Plan drafted: %d steps.", len(result))

        return result


class GroqReflectionAgent(ReflectionAgent):
    def __init__(self):
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)
        logger.info("[GROQ] ReflectionAgent initialized.")

    async def reflect(
        self,
        trigger: str,
        related_objectives: List[dict],
        related_learnings: List[dict],
        related_decisions: List[dict],
    ) -> Reflection:
        logger.info(
            "[GROQ] Reflecting on: '%s' | context: %d obj, %d learn, %d dec",
            trigger[:60], len(related_objectives), len(related_learnings), len(related_decisions),
        )

        context_parts = []
        if related_objectives:
            context_parts.append(
                "Past objectives:\n" +
                "\n".join(f"- {o.get('what', '')} (why: {o.get('why', 'N/A')})" for o in related_objectives[:5])
            )
        if related_learnings:
            context_parts.append(
                "Past learnings:\n" +
                "\n".join(f"- [{l.get('category', '')}] {l.get('content', '')}" for l in related_learnings[:5])
            )
        if related_decisions:
            context_parts.append(
                "Past decisions:\n" +
                "\n".join(f"- {d.get('decision', '')} (why: {d.get('why', '')})" for d in related_decisions[:5])
            )

        context_block = "\n\n".join(context_parts) if context_parts else "No prior context available."

        response = await self._client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are JARVIS, a reflective thinking partner for a solo business owner. "
                        "Given the user's question and their history of objectives, learnings, and decisions, "
                        "provide a thoughtful reflection. "
                        "Return JSON with keys: "
                        '"summary" (thoughtful 2-4 paragraph reflection), '
                        '"patterns_identified" (list of recurring patterns you notice), '
                        '"suggestions" (list of actionable next steps or considerations).'
                    ),
                },
                {
                    "role": "user",
                    "content": f"Question: {trigger}\n\nContext:\n{context_block}",
                },
            ],
        )

        parsed = json.loads(response.choices[0].message.content)
        logger.info(
            "[GROQ] Reflection complete: %d patterns, %d suggestions.",
            len(parsed.get("patterns_identified", [])), len(parsed.get("suggestions", [])),
        )

        return Reflection(
            trigger=trigger,
            summary=parsed.get("summary", ""),
            patterns_identified=parsed.get("patterns_identified", []),
            suggestions=parsed.get("suggestions", []),
            related_objective_ids=[o.get("id", "") for o in related_objectives[:5] if o.get("id")],
            related_learning_ids=[l.get("id", "") for l in related_learnings[:5] if l.get("id")],
        )


class GroqInsightAgent(InsightAgent):
    def __init__(self):
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)
        logger.info("[GROQ] InsightAgent initialized.")

    async def extract_learnings(self, objective: Objective) -> List[Learning]:
        logger.info("[GROQ] Extracting learnings from objective_id=%s ('%s')", objective.id, objective.what[:60])

        plan_summary = ""
        if objective.plan:
            plan_summary = "\n".join(f"  {s.step_number}. {s.description} [{s.status}]" for s in objective.plan)

        response = await self._client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are JARVIS. Analyze a completed objective and extract learnings. "
                        "Return JSON with key 'learnings' — an array of objects with: "
                        '"content" (the learning), '
                        '"category" (one of: insight, mistake, success, pattern, tool, process), '
                        '"tags" (list of relevant tags), '
                        '"confidence" (float 0-1, how confident you are this is a real learning).'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Objective: {objective.what}\n"
                        f"Why: {objective.why or 'N/A'}\n"
                        f"Context: {objective.context}\n"
                        f"Expected Output: {objective.expected_output}\n"
                        f"Outcome: {objective.outcome or 'Not recorded'}\n"
                        f"Plan:\n{plan_summary or 'No plan'}\n"
                        f"Status: {objective.status.value}\n"
                        f"Progress: {objective.workdone}%"
                    ),
                },
            ],
        )

        parsed = json.loads(response.choices[0].message.content)
        learnings = []
        for item in parsed.get("learnings", []):
            cat = item.get("category", "insight")
            try:
                category = LearningCategory(cat)
            except ValueError:
                category = LearningCategory.INSIGHT
            learnings.append(Learning(
                content=item.get("content", ""),
                category=category,
                tags=item.get("tags", []),
                source_objective_id=objective.id,
                confidence=float(item.get("confidence", 0.7)),
            ))

        logger.info("[GROQ] Extracted %d learnings from objective_id=%s", len(learnings), objective.id)
        return learnings
