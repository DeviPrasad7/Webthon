import { chatCompletion } from "../core/llm.js";

export interface ExtractedInsights {
  success_driver: string;
  failure_reason: string;
}

function buildPrompt(outcome: string): string {
  if (outcome === "SUCCESS") {
    return `System: You are a cognitive analyst extracting patterns from a user's completed project.
The outcome was SUCCESS. Your primary job is to identify the success driver.
Rule 1: Identify ONE core success driver (what went right / what made this succeed). Be specific to this project — mention the strategy, approach, or decision that drove success. Examples: "Targeted niche college market", "Strong supplier relationships", "Lean MVP approach".
Rule 2: For failure_reason, since this was a success, note one area that could be improved next time, or output "None" if nothing stands out.
Rule 3: Keep each under 8 words.
Rule 4: NEVER output "No clear pattern" for success_driver when the outcome is SUCCESS. Always find something specific.
Rule 5: Respond ONLY in JSON:
{
  "success_driver": "string",
  "failure_reason": "string"
}`;
  }
  if (outcome === "FAILURE") {
    return `System: You are a cognitive analyst extracting patterns from a user's failed project.
The outcome was FAILURE. Your primary job is to identify the failure reason.
Rule 1: Identify ONE core failure reason (what went wrong / what caused this to fail). Be specific — mention the decision, oversight, or external factor. Examples: "Underestimated competitor pricing", "No market validation done", "Ran out of budget".
Rule 2: For success_driver, note one thing that went right despite the failure, or output "None" if nothing stands out.
Rule 3: Keep each under 8 words.
Rule 4: NEVER output "No clear pattern" for failure_reason when the outcome is FAILURE. Always find something specific.
Rule 5: Respond ONLY in JSON:
{
  "success_driver": "string",
  "failure_reason": "string"
}`;
  }
  // PARTIAL
  return `System: You are a cognitive analyst extracting patterns from a user's partially successful project.
The outcome was PARTIAL. Identify both what worked and what didn't.
Rule 1: Identify ONE core success driver (what went right) and ONE failure reason (what went wrong).
Rule 2: Keep each under 8 words. Be specific to this project.
Rule 3: NEVER output "No clear pattern" — always find something specific for both fields.
Rule 4: Respond ONLY in JSON:
{
  "success_driver": "string",
  "failure_reason": "string"
}`;
}

export async function extractInsights(
  rawReflection: string,
  what: string,
  outcome: string
): Promise<ExtractedInsights> {
  const systemPrompt = buildPrompt(outcome);
  const userMessage = `Objective: ${what}\nOutcome: ${outcome}\nReflection: ${rawReflection || "No detailed reflection provided."}`;

  const responseText = await chatCompletion(systemPrompt, userMessage);
  const parsed = JSON.parse(responseText);

  const successDriver = parsed.success_driver || (outcome === "SUCCESS" ? "Completed successfully" : "None");
  const failureReason = parsed.failure_reason || (outcome === "FAILURE" ? "Did not meet expectations" : "None");

  return {
    success_driver: successDriver,
    failure_reason: failureReason,
  };
}
