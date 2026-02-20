import {
  insertObjective,
  enqueueJob,
  getObjectiveById,
  getObjectivesByUser,
  confirmPlan,
  updatePlan,
  completeObjective,
  fastTrackComplete,
  notifyObjectiveUpdate,
  softDeleteObjective,
  type PlanStep,
  type ObjectiveRow,
} from "./queries.js";
import { chatCompletionMultiTurn, type ChatMessage } from "../core/llm.js";

export interface CreateObjectiveInput {
  raw_input: string;
  is_voice?: boolean;
}

export interface ObjectiveWithProgress extends ObjectiveRow {
  progress_percentage: number;
}

function computeProgress(plan: PlanStep[]): number {
  if (!plan || plan.length === 0) return 0;
  const doneCount = plan.filter((s) => s.status === "done").length;
  return Math.round((doneCount / plan.length) * 100);
}

function enrichWithProgress(obj: ObjectiveRow): ObjectiveWithProgress {
  return { ...obj, progress_percentage: computeProgress(obj.plan) };
}

export async function createObjective(
  userId: string,
  input: CreateObjectiveInput
): Promise<string> {
  if (!input.raw_input?.trim()) throw new Error("'raw_input' is required");

  const objectiveId = await insertObjective(userId, input.raw_input.trim(), input.is_voice || false);
  await enqueueJob("DRAFT_AND_SEARCH", { objective_id: objectiveId });
  return objectiveId;
}

export async function fetchObjective(id: string): Promise<ObjectiveWithProgress | null> {
  const obj = await getObjectiveById(id);
  if (!obj) return null;
  return enrichWithProgress(obj);
}

export async function fetchObjectivesByUser(userId: string): Promise<ObjectiveWithProgress[]> {
  const rows = await getObjectivesByUser(userId);
  return rows.map(enrichWithProgress);
}

export async function confirmObjectivePlan(id: string, plan: PlanStep[]): Promise<void> {
  if (!plan || plan.length === 0) throw new Error("Plan must have at least one step");
  await confirmPlan(id, plan);
  await notifyObjectiveUpdate(id);
}

export async function updateObjectivePlan(id: string, plan: PlanStep[]): Promise<void> {
  if (!plan || plan.length === 0) throw new Error("Plan must have at least one step");
  await updatePlan(id, plan);
  await notifyObjectiveUpdate(id);
}

export async function completeObjectiveFlow(
  id: string,
  outcome: string,
  rawReflection: string
): Promise<void> {
  const obj = await getObjectiveById(id);
  if (!obj) throw new Error("Objective not found");

  const pendingSteps = (obj.plan || []).filter((s: PlanStep) => s.status === "pending");
  if (pendingSteps.length > 0) {
    throw new Error(`Cannot complete: ${pendingSteps.length} steps are still pending.`);
  }

  const validOutcomes = ["SUCCESS", "PARTIAL", "FAILURE"];
  if (!validOutcomes.includes(outcome)) {
    throw new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`);
  }

  await completeObjective(id, outcome, rawReflection);
  await enqueueJob("EXTRACT_AND_EMBED", { objective_id: id });
  await notifyObjectiveUpdate(id);
}

export async function fastTrackObjective(
  id: string,
  outcome: string,
  rawReflection: string
): Promise<void> {
  const obj = await getObjectiveById(id);
  if (!obj) throw new Error("Objective not found");

  const validOutcomes = ["SUCCESS", "PARTIAL", "FAILURE"];
  if (!validOutcomes.includes(outcome)) {
    throw new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`);
  }

  await fastTrackComplete(id, outcome, rawReflection);
  await enqueueJob("EXTRACT_AND_EMBED", { objective_id: id });
  await notifyObjectiveUpdate(id);
}

export async function deleteObjective(id: string): Promise<void> {
  await softDeleteObjective(id);
}

export async function chatAboutPlan(
  id: string,
  messages: ChatMessage[]
): Promise<{ reply: string; revised_plan?: PlanStep[] }> {
  const obj = await getObjectiveById(id);
  if (!obj) throw new Error("Objective not found");

  const systemPrompt = `You are JARVIS, a cognitive companion for a solopreneur.
Decision: ${obj.what || obj.raw_input}
Context: ${obj.context || ""}
Expected Output: ${obj.expected_output || ""}

Current plan:
${(obj.plan || []).map((s: PlanStep, i: number) => `${i + 1}. [${s.status}] ${s.desc}${s.notes ? ` (note: ${s.notes})` : ""}`).join("\n")}

The user wants to discuss or modify this plan.
Always respond in JSON: { "reply": "your message", "revised_plan": [...] | null }
revised_plan items: { step_id (uuid), desc (string), status ("pending"|"done"|"skipped"), notes (string, optional) }.`;

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const raw = await chatCompletionMultiTurn(allMessages);
  try {
    const parsed = JSON.parse(raw);
    return { reply: parsed.reply || raw, revised_plan: parsed.revised_plan || undefined };
  } catch {
    return { reply: raw };
  }
}
