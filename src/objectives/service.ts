import {
  insertObjective,
  enqueueJob,
  getObjectiveById,
  getObjectivesByUser,
  confirmPlan,
  updatePlan,
  completeObjective,
  notifyObjectiveUpdate,
  softDeleteObjective,
  type PlanStep,
  type ObjectiveRow,
} from "./queries.js";

export interface CreateObjectiveInput {
  what: string;
  context: string;
  expected_output: string;
  decision_rationale: string;
}

export interface ObjectiveWithProgress extends ObjectiveRow {
  progress_percentage: number;
}

/**
 * Compute progress dynamically from plan steps.
 */
function computeProgress(plan: PlanStep[]): number {
  if (!plan || plan.length === 0) return 0;
  const doneCount = plan.filter((s) => s.status === "done").length;
  return Math.round((doneCount / plan.length) * 100);
}

/**
 * Enrich an objective row with computed progress.
 */
function enrichWithProgress(obj: ObjectiveRow): ObjectiveWithProgress {
  return {
    ...obj,
    progress_percentage: computeProgress(obj.plan),
  };
}

/**
 * Create a new objective and enqueue the DRAFT_AND_SEARCH job.
 */
export async function createObjective(
  userId: string,
  input: CreateObjectiveInput
): Promise<string> {
  if (!input.what?.trim()) throw new Error("'what' is required");
  if (!input.context?.trim()) throw new Error("'context' is required");
  if (!input.expected_output?.trim()) throw new Error("'expected_output' is required");
  if (!input.decision_rationale?.trim()) throw new Error("'decision_rationale' is required");

  const objectiveId = await insertObjective(
    userId,
    input.what.trim(),
    input.context.trim(),
    input.expected_output.trim(),
    input.decision_rationale.trim()
  );

  await enqueueJob("DRAFT_AND_SEARCH", { objective_id: objectiveId });

  return objectiveId;
}

/**
 * Fetch a single objective with progress.
 */
export async function fetchObjective(
  id: string
): Promise<ObjectiveWithProgress | null> {
  const obj = await getObjectiveById(id);
  if (!obj) return null;
  return enrichWithProgress(obj);
}

/**
 * Fetch all objectives for a user with progress.
 */
export async function fetchObjectivesByUser(
  userId: string
): Promise<ObjectiveWithProgress[]> {
  const rows = await getObjectivesByUser(userId);
  return rows.map(enrichWithProgress);
}

/**
 * Confirm a plan by overwriting the JSONB and transitioning to ACTIVE.
 */
export async function confirmObjectivePlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  if (!plan || plan.length === 0) {
    throw new Error("Plan must have at least one step");
  }
  await confirmPlan(id, plan);
  await notifyObjectiveUpdate(id);
}

/**
 * Update the plan (execution progress). Full JSONB overwrite.
 */
export async function updateObjectivePlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  if (!plan || plan.length === 0) {
    throw new Error("Plan must have at least one step");
  }
  await updatePlan(id, plan);
  await notifyObjectiveUpdate(id);
}

/**
 * Complete an objective with outcome and reflection.
 * Validates all steps are non-pending before allowing completion.
 */
export async function completeObjectiveFlow(
  id: string,
  outcome: string,
  rawReflection: string
): Promise<void> {
  const obj = await getObjectiveById(id);
  if (!obj) throw new Error("Objective not found");

  // Validate no pending steps remain
  const pendingSteps = (obj.plan || []).filter((s: PlanStep) => s.status === "pending");
  if (pendingSteps.length > 0) {
    throw new Error(
      `Cannot complete: ${pendingSteps.length} steps are still pending. Mark them as done or skipped first.`
    );
  }

  const validOutcomes = ["SUCCESS", "PARTIAL", "FAILURE"];
  if (!validOutcomes.includes(outcome)) {
    throw new Error(`Invalid outcome. Must be one of: ${validOutcomes.join(", ")}`);
  }

  await completeObjective(id, outcome, rawReflection);
  await enqueueJob("EXTRACT_AND_EMBED", { objective_id: id });
  await notifyObjectiveUpdate(id);
}

/**
 * Soft-delete an objective.
 */
export async function deleteObjective(id: string): Promise<void> {
  await softDeleteObjective(id);
}
