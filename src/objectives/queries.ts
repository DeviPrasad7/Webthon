import { query } from "../core/db.js";

export interface PlanStep {
  step_id: string;
  desc: string;
  status: "pending" | "done" | "skipped";
  notes?: string;
}

export interface ObjectiveRow {
  id: string;
  user_id: string;
  status: string;
  raw_input: string;
  is_voice: boolean;
  what: string | null;
  context: string | null;
  expected_output: string | null;
  decision_rationale: string | null;
  jarvis_insight: string | null;
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

export async function insertObjective(
  userId: string,
  rawInput: string,
  isVoice: boolean = false
): Promise<string> {
  const result = await query(
    `INSERT INTO objectives (user_id, raw_input, is_voice)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, rawInput, isVoice]
  );
  return result.rows[0].id;
}

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

export async function getObjectiveById(
  id: string
): Promise<ObjectiveRow | null> {
  const result = await query(
    `SELECT * FROM objectives WHERE id = $1 AND is_deleted = false`,
    [id]
  );
  return result.rows[0] || null;
}

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

export async function updatePlan(
  id: string,
  plan: PlanStep[]
): Promise<void> {
  await query(
    `UPDATE objectives SET plan = $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(plan), id]
  );
}

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

export async function updateDraftResults(
  id: string,
  plan: PlanStep[],
  suggestedSimilarities: object[],
  parsedFields?: { what?: string; context?: string; expected_output?: string; decision_rationale?: string },
  jarvisInsight?: string
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET plan = $1::jsonb, suggested_similarities = $2::jsonb,
         what = COALESCE($4, what), context = COALESCE($5, context),
         expected_output = COALESCE($6, expected_output),
         decision_rationale = COALESCE($7, decision_rationale),
         jarvis_insight = COALESCE($8, jarvis_insight),
         updated_at = NOW() 
     WHERE id = $3`,
    [
      JSON.stringify(plan),
      JSON.stringify(suggestedSimilarities),
      id,
      parsedFields?.what || null,
      parsedFields?.context || null,
      parsedFields?.expected_output || null,
      parsedFields?.decision_rationale || null,
      jarvisInsight || null,
    ]
  );
}

export async function fastTrackComplete(
  id: string,
  outcome: string,
  rawReflection: string
): Promise<void> {
  await query(
    `UPDATE objectives 
     SET status = 'COMPLETED', outcome = $1, raw_reflection = $2, 
         plan = '[]'::jsonb, completed_at = NOW(), updated_at = NOW() 
     WHERE id = $3`,
    [outcome, rawReflection, id]
  );
}

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

export async function notifyObjectiveUpdate(objectiveId: string): Promise<void> {
  await query(`NOTIFY objective_updates, '${JSON.stringify({ id: objectiveId })}'`);
}

export async function softDeleteObjective(id: string): Promise<void> {
  await query(
    `UPDATE objectives SET is_deleted = true, updated_at = NOW() WHERE id = $1`,
    [id]
  );
}
