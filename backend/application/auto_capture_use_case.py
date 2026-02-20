"""
Auto-capture use case — detects learnings, decisions, and objectives
from natural chat messages and saves them automatically.
The user just talks; JARVIS captures everything structured behind the scenes.
"""

import json
import logging
from typing import Dict, List, Optional
from groq import AsyncGroq
from backend.config import get_settings

logger = logging.getLogger("jarvis.usecase.autocapture")

EXTRACTION_PROMPT = """You are an AI classifier for a personal business assistant.

Analyze the USER MESSAGE below and determine if it contains any of the following:

1. **learning** — An insight, lesson, mistake, success, pattern, tool tip, or process improvement.
   Examples: "I learned that...", "Never do X again", "Posting on LinkedIn works", "I messed up by..."
2. **decision** — A business decision the user made or is announcing.
   Examples: "I decided to...", "I'm going with option A", "We're switching to..."
3. **objective** — A goal, project, or thing the user wants to accomplish.
   Examples: "I want to...", "My goal is...", "I need to build...", "Let's launch..."

RULES:
- A message can contain MULTIPLE items (e.g., a learning AND a decision).
- Only extract if the user is CLEARLY stating something — not asking a question.
- Questions like "What should I do?" are NOT capturable.
- Generic greetings or small talk should return empty.
- Be conservative — only capture when there's real substance.
- For learnings, classify the category: insight, mistake, success, pattern, tool, process.
- Extract relevant tags (1-4 short words).

Respond with ONLY valid JSON. Example format:
{{"items": [{{"type": "learning", "content": "the learning", "category": "mistake", "tags": ["pricing"]}}, {{"type": "decision", "decision": "what was decided", "why": "reason", "context": "situation", "tags": ["strategy"]}}, {{"type": "objective", "text": "what to achieve", "tags": ["marketing"]}}]}}

If NOTHING is capturable, respond: {{"items": []}}

USER MESSAGE:
{message}

ASSISTANT REPLY (for additional context):
{reply}"""


class AutoCaptureUseCase:
    """Detect and extract structured data from natural chat messages."""

    def __init__(self):
        self._client = AsyncGroq(api_key=get_settings().groq_api_key)

    async def detect_and_extract(
        self, user_message: str, assistant_reply: str
    ) -> List[Dict]:
        """
        Analyze a user message + JARVIS reply and extract any
        learnings, decisions, or objectives mentioned.
        Returns a list of extracted items (may be empty).
        """
        # Skip very short or question-only messages
        if len(user_message.strip()) < 15:
            return []

        # Skip pure questions (heuristic)
        stripped = user_message.strip()
        if stripped.endswith("?") and not any(
            kw in stripped.lower()
            for kw in [
                "learned", "decided", "realized", "mistake",
                "going to", "i will", "i want to", "switching",
                "never again", "lesson", "success",
            ]
        ):
            return []

        try:
            prompt = EXTRACTION_PROMPT.format(
                message=user_message, reply=assistant_reply[:500]
            )

            response = await self._client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.1,
                max_tokens=1000,
                messages=[
                    {"role": "system", "content": "You extract structured data from text. Respond with ONLY a single-line compact JSON object, no formatting or newlines within the JSON."},
                    {"role": "user", "content": prompt},
                ],
            )

            finish_reason = response.choices[0].finish_reason
            raw = response.choices[0].message.content.strip()
            logger.debug("[AUTOCAPTURE] finish_reason=%s, raw_len=%d", finish_reason, len(raw))

            # Clean markdown fences if present
            if raw.startswith("```"):
                first_newline = raw.find("\n")
                if first_newline != -1:
                    raw = raw[first_newline + 1:]
                else:
                    raw = raw[3:]
                if raw.rstrip().endswith("```"):
                    raw = raw.rstrip()[:-3]
                raw = raw.strip()

            # Find the outermost JSON object by matching braces
            start_idx = raw.find("{")
            if start_idx == -1:
                logger.debug("[AUTOCAPTURE] No JSON object found in response.")
                return []

            # Walk through to find the matching closing brace
            depth = 0
            end_idx = start_idx
            in_string = False
            escape_next = False
            for i in range(start_idx, len(raw)):
                c = raw[i]
                if escape_next:
                    escape_next = False
                    continue
                if c == '\\' and in_string:
                    escape_next = True
                    continue
                if c == '"' and not escape_next:
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        end_idx = i
                        break

            json_str = raw[start_idx:end_idx + 1]

            # Try parsing; if truncated, attempt to fix by closing open brackets
            try:
                result = json.loads(json_str)
            except json.JSONDecodeError:
                # Try simpler approach: find all complete item objects
                # Look for individual items within the truncated JSON
                result = self._parse_partial_items(raw)
                if not result:
                    logger.warning("[AUTOCAPTURE] JSON parse error, attempting recovery from raw: '%s'", raw[:400])
                    return []
            items = result.get("items", [])

            if items:
                logger.info(
                    "[AUTOCAPTURE] Extracted %d items from message: %s",
                    len(items),
                    [i.get("type") for i in items],
                )
            else:
                logger.debug("[AUTOCAPTURE] No items to capture from message.")

            return items

        except json.JSONDecodeError as e:
            logger.warning("[AUTOCAPTURE] JSON parse error: %s | raw: '%s'", e, raw[:300] if 'raw' in dir() else 'N/A')
            return []
        except Exception as e:
            import traceback
            logger.warning("[AUTOCAPTURE] Extraction failed (type=%s): %s\n%s", type(e).__name__, e, traceback.format_exc())
            return []

    @staticmethod
    def _parse_partial_items(raw: str) -> Optional[Dict]:
        """
        Attempt to recover items from a potentially truncated JSON response.
        Extracts individual complete JSON objects that have a 'type' field.
        """
        import re
        items = []
        # Find all {...} blocks that contain "type"
        # Use a simple regex to find individual item objects
        pattern = r'\{[^{}]*"type"\s*:\s*"[^"]*"[^{}]*\}'
        matches = re.findall(pattern, raw)
        for match in matches:
            try:
                obj = json.loads(match)
                if "type" in obj:
                    items.append(obj)
            except json.JSONDecodeError:
                continue

        if items:
            logger.info("[AUTOCAPTURE] Recovered %d items from partial JSON", len(items))
            return {"items": items}
        return None
