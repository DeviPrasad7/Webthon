import { query } from "../core/db.js";

export interface PlanStep {
  step_id: string;
  desc: string;
  status: "pending" | "done" | "skipped";
}

export interface ObjectiveRow {
  id: string;
  user_id: string;
  status: string;
  what: string;
  context: string;
  expected_output: string;
  decision_rationale: string;
  plan: PlanStep[];
  outcome: string | null;
  raw_reflection: string | null;
  success_driver: string | null;
  failure_reason: string | null;
  suggested_similarities: object[];
  is_deleted: boolean;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

/**
 * Insert a new objective in PLANNING status.
 */
export async function insertObjective(
  userId: string,
  what: string,
  context: string,
  expectedOutput: string,
  decisionRationale: string
): Promise<string> {
  const result = await query(
    `INSERT INTO objectives (user_id, what, context, expected_output, decision_rationale)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, what, context, expectedOutput, decisionRationale]
  );
  return result.rows[0].id;
}

/**
 * Enqueue a background job.
 */
export async function enqueueJob(
  type: string,
  payload: object
): Promise<string> {
  const result = await query(
    `INSERT INTO background_jobs (type, payload)
     VALUES ($1, $2::jsonb)
     RETURNING id`,
    [type, JSON.stringify(payload)]
  );
  return result.rows[0].id;
}

/**
 * Fetch a single objective by id (non-deleted).
 */
export async function getObjectiveById(
  id: string
): Promise<ObjectiveRow | null> {
  const result = await query(
    `SELECT * FROM objectives WHERE id = $1 AND is_deleted = false`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Fetch all objectives for a user (non-deleted), ordered by most recent.
 */
export async function getObjectivesByUser(
  userId: string
): Promise<ObjectiveRow[]> {
  const result = await query(
    `SELECT * FROM objectives 
     WHERE user_id = $1 AND is_deleted = false 
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Confirm the plan: overwrite plan JSONB and set status to ACTIVE.
 */
export async function confirmPlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET plan = $1::jsonb, status = 'ACTIVE', updated_at = NOW() 
     WHERE id = $2`,
    [JSON.stringify(plan), id]
  );
}

/**
 * Overwrite the plan JSONB (execution update).
 */
export async function updatePlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  await query(
    `UPDATE objectives SET plan = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(plan), id]
  );
}

/**
 * Mark an objective as completed with outcome and reflection.
 */
export async function completeObjective(
  id: string,
  outcome: string,
  rawReflection: string
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET status = 'COMPLETED', outcome = $1, raw_reflection = $2, 
         completed_at = NOW(), updated_at = NOW() 
     WHERE id = $3`,
    [outcome, rawReflection, id]
  );
}

/**
 * Update objective with plan and suggested similarities (from DRAFT_AND_SEARCH job).
 */
export async function updateDraftResults(
  id: string,
  plan: PlanStep[],
  suggestedSimilarities: object[]
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET plan = $1::jsonb, suggested_similarities = $2::jsonb, updated_at = NOW() 
     WHERE id = $3`,
    [JSON.stringify(plan), JSON.stringify(suggestedSimilarities), id]
  );
}

/**
 * Update objective with extracted insights (from EXTRACT_AND_EMBED job).
 */
export async function updateInsights(
  id: string,
  successDriver: string,
  failureReason: string
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET success_driver = $1, failure_reason = $2, updated_at = NOW() 
     WHERE id = $3`,
    [successDriver, failureReason, id]
  );
}

/**
 * Send NOTIFY on objective_updates channel.
 */
export async function notifyObjectiveUpdate(objectiveId: string): Promise<void> {
  await query(`NOTIFY objective_updates, '${JSON.stringify({ id: objectiveId })}'`);
}

/**
 * Soft delete an objective.
 */
export async function softDeleteObjective(id: string): Promise<void> {
  await query(
    `UPDATE objectives SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}
