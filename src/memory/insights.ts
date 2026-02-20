import { chatCompletion } from "../core/llm.js";

export interface ExtractedInsights {
  success_driver: string;
  failure_reason: string;
}

const REFLECTION_SYSTEM_PROMPT = `System: You are a cognitive analyst extracting patterns from a user's post-project reflection.
Rule 1: Identify ONE core success driver (what went right) and ONE failure reason (what went wrong/could be better).
Rule 2: Keep them under 8 words each.
Rule 3: If the reflection is too vague or meaningless (e.g., "it was ok"), output "No clear pattern" for the fields. Do not hallucinate.
Rule 4: Respond ONLY in JSON using this schema:
{
  "success_driver": "string",
  "failure_reason": "string"
}`;

export async function extractInsights(
  rawReflection: string,
  what: string,
  outcome: string
): Promise<ExtractedInsights> {
  const userMessage = `Objective: ${what}\nOutcome: ${outcome}\nReflection: ${rawReflection}`;

  const responseText = await chatCompletion(REFLECTION_SYSTEM_PROMPT, userMessage);
  const parsed = JSON.parse(responseText);

  return {
    success_driver: parsed.success_driver || "No clear pattern",
    failure_reason: parsed.failure_reason || "No clear pattern",
  };
}
