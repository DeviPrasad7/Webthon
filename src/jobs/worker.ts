import dotenv from "dotenv";
dotenv.config();

import { query} from "../core/db.js";
import { chatCompletion, generateEmbedding, contentHash } from "../core/llm.js";
import {
  getObjectiveById,
  updateDraftResults,
  updateInsights,
  notifyObjectiveUpdate,
  type PlanStep,
} from "../objectives/queries.js";
import { findSimilarObjectives, upsertEmbedding } from "../memory/vector.js";
import { extractInsights } from "../memory/insights.js";
import { runMigrations } from "../core/db.js";

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);

// ─── PLAN DRAFTING PROMPT ──────────────────────────────────────────────
const PLAN_SYSTEM_PROMPT = `System: You are an execution strategist. The user is providing a decision and context. Break it down into an actionable plan.
Rule 1: Return EXACTLY 5 to 15 steps.
Rule 2: Respond ONLY in JSON using this schema:
{
  "plan": [
    { "step_id": "uuid", "desc": "string (max 10 words)", "status": "pending" }
  ]
}`;

// ─── CLAIM A JOB (SKIP LOCKED) ────────────────────────────────────────
async function claimJob(): Promise<any | null> {
  const result = await query(
    `UPDATE background_jobs 
     SET status = 'processing', retry_count = retry_count + 1 
     WHERE id = (
       SELECT id FROM background_jobs 
       WHERE status IN ('pending', 'failed') 
         AND next_retry_at <= NOW() 
         AND retry_count < 3
       ORDER BY created_at ASC 
       FOR UPDATE SKIP LOCKED 
       LIMIT 1
     ) RETURNING *`
  );
  return result.rows[0] || null;
}

// ─── MARK JOB DONE ────────────────────────────────────────────────────
async function markJobDone(jobId: string): Promise<void> {
  await query(
    `UPDATE background_jobs SET status = 'done' WHERE id = $1`,
    [jobId]
  );
}

// ─── MARK JOB FAILED (exponential backoff) ─────────────────────────────
async function markJobFailed(
  jobId: string,
  retryCount: number,
  error: string
): Promise<void> {
  await query(
    `UPDATE background_jobs 
     SET status = 'failed', 
         last_error = $1, 
         next_retry_at = NOW() + INTERVAL '1 min' * pow(2, $2)
     WHERE id = $3`,
    [error, retryCount, jobId]
  );
}

// ─── HANDLER: DRAFT_AND_SEARCH ─────────────────────────────────────────
async function handleDraftAndSearch(payload: { objective_id: string }): Promise<void> {
  const objective = await getObjectiveById(payload.objective_id);
  if (!objective) throw new Error(`Objective ${payload.objective_id} not found`);

  // 1. Build the text to embed
  const textToEmbed = `What: ${objective.what} Context: ${objective.context} Expected: ${objective.expected_output} Why: ${objective.decision_rationale}`;

  // 2. Generate embedding
  const vector = await generateEmbedding(textToEmbed);

  // 3. Query pgvector for similar past objectives
  const similar = await findSimilarObjectives(
    vector,
    objective.user_id,
    objective.id,
    3
  );

  // Build suggested_similarities with details
  let suggestedSimilarities: object[] = [];
  if (similar.length > 0) {
    const ids = similar.map((s) => s.objective_id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const detailsResult = await query(
      `SELECT id, what, outcome, success_driver, failure_reason
       FROM objectives WHERE id IN (${placeholders})`,
      ids
    );
    suggestedSimilarities = similar.map((s) => {
      const detail = detailsResult.rows.find((r: any) => r.id === s.objective_id);
      return {
        objective_id: s.objective_id,
        distance: s.distance,
        what: detail?.what,
        outcome: detail?.outcome,
        success_driver: detail?.success_driver,
        failure_reason: detail?.failure_reason,
      };
    });
  }

  // 4. Call LLM to draft plan
  const userMessage = `Decision: ${objective.what}\nContext: ${objective.context}\nExpected Output: ${objective.expected_output}\nRationale: ${objective.decision_rationale}`;
  const planResponse = await chatCompletion(PLAN_SYSTEM_PROMPT, userMessage);
  const parsedPlan = JSON.parse(planResponse);
  const plan: PlanStep[] = parsedPlan.plan || [];

  // 5. Update objective with plan and similarities
  await updateDraftResults(objective.id, plan, suggestedSimilarities);

  // 6. Notify via LISTEN/NOTIFY
  await notifyObjectiveUpdate(objective.id);

  console.log(`[Worker] DRAFT_AND_SEARCH completed for objective ${objective.id}`);
}

// ─── HANDLER: EXTRACT_AND_EMBED ────────────────────────────────────────
async function handleExtractAndEmbed(payload: { objective_id: string }): Promise<void> {
  const objective = await getObjectiveById(payload.objective_id);
  if (!objective) throw new Error(`Objective ${payload.objective_id} not found`);

  // 1. Extract insights from reflection
  const insights = await extractInsights(
    objective.raw_reflection || "",
    objective.what,
    objective.outcome || ""
  );

  // 2. Update objective with insights
  await updateInsights(objective.id, insights.success_driver, insights.failure_reason);

  // 3. Build embedding text (includes outcome info for future similarity matching)
  const embeddingText = `What: ${objective.what} Rationale: ${objective.decision_rationale} Outcome: ${objective.outcome} Success Driver: ${insights.success_driver} Failure Reason: ${insights.failure_reason}`;

  // 4. Generate embedding and content hash
  const vector = await generateEmbedding(embeddingText);
  const hash = await contentHash(embeddingText);

  // 5. Upsert embedding
  await upsertEmbedding(objective.id, objective.user_id, vector, hash);

  // 6. Notify
  await notifyObjectiveUpdate(objective.id);

  console.log(`[Worker] EXTRACT_AND_EMBED completed for objective ${objective.id}`);
}

// ─── MAIN POLLING LOOP ─────────────────────────────────────────────────
async function pollLoop(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      console.log(`[Worker] Processing job ${job.id} (type: ${job.type})`);

      try {
        switch (job.type) {
          case "DRAFT_AND_SEARCH":
            await handleDraftAndSearch(job.payload);
            break;
          case "EXTRACT_AND_EMBED":
            await handleExtractAndEmbed(job.payload);
            break;
          default:
            throw new Error(`Unknown job type: ${job.type}`);
        }
        await markJobDone(job.id);
      } catch (err: any) {
        console.error(`[Worker] Job ${job.id} failed:`, err.message);
        await markJobFailed(job.id, job.retry_count, err.message);
      }
    } catch (err) {
      console.error("[Worker] Poll loop error:", err);
      await sleep(POLL_INTERVAL * 2);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── ENTRY POINT ───────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("[Worker] Starting...");
  await runMigrations();
  console.log("[Worker] Entering poll loop...");
  await pollLoop();
}

main().catch((err) => {
  console.error("[Worker] Fatal error:", err);
  process.exit(1);
});
