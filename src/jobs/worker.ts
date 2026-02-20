import dotenv from "dotenv";
dotenv.config();

import { query } from "../core/db.js";
import { chatCompletion, contentHash } from "../core/llm.js";
import {
  getObjectiveById,
  updateDraftResults,
  updateInsights,
  notifyObjectiveUpdate,
  type PlanStep,
} from "../objectives/queries.js";
import { findSimilarPastDecisions, buildSearchText, buildQueryText, updateSearchText } from "../memory/retrieval.js";
import { embed } from "../memory/embeddings.js";
import { upsertEmbedding } from "../memory/vector.js";
import { extractInsights } from "../memory/insights.js";
import { runMigrations } from "../core/db.js";

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10);

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

async function markJobDone(jobId: string): Promise<void> {
  await query(
    `UPDATE background_jobs SET status = 'done' WHERE id = $1`,
    [jobId]
  );
}

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

async function handleDraftAndSearch(payload: { objective_id: string }): Promise<void> {
  const objective = await getObjectiveById(payload.objective_id);
  if (!objective) throw new Error(`Objective ${payload.objective_id} not found`);

  console.log(`[Worker] Step 1/3 — Parsing raw input for ${objective.id}`);
  const parseSystem = `You are a structured-data extractor. The user will give a messy brain-dump about a decision they need to make. Extract exactly these four fields.
Respond ONLY in JSON:
{
  "what": "one-liner describing the decision (max 15 words)",
  "context": "relevant background info (2-3 sentences max)",
  "expected_output": "what a good outcome looks like (1 sentence)",
  "decision_rationale": "why this matters / reasoning (1-2 sentences)"
}
If info is missing, infer a reasonable value — NEVER leave fields empty.`;

  const parseResponse = await chatCompletion(parseSystem, objective.raw_input);
  let parsedFields: { what: string; context: string; expected_output: string; decision_rationale: string };
  try {
    parsedFields = JSON.parse(parseResponse);
  } catch {
    parsedFields = {
      what: objective.raw_input.slice(0, 200),
      context: "",
      expected_output: "",
      decision_rationale: "",
    };
  }

  console.log(`[Worker] Step 2/3 — Retrieving similar past decisions for ${objective.id}`);
  const searchText = buildQueryText({
    what: parsedFields.what,
    context: parsedFields.context,
    decision_rationale: parsedFields.decision_rationale,
  });
  const similarMatches = await findSimilarPastDecisions(
    searchText,
    objective.user_id,
    objective.id,
    5
  );
  if (similarMatches.length > 0) {
    console.log(`[Worker] Top match: "${similarMatches[0].what}" — ${(similarMatches[0].similarity_score * 100).toFixed(1)}%`);
  }

  console.log(`[Worker] Found ${similarMatches.length} similar past decisions`);

  const suggestedSimilarities = similarMatches.map((m) => ({
    objective_id: m.objective_id,
    similarity_score: m.similarity_score,
    what: m.what || m.raw_input?.slice(0, 100),
    raw_input: m.raw_input,
    context: m.context,
    expected_output: m.expected_output,
    decision_rationale: m.decision_rationale,
    outcome: m.outcome,
    raw_reflection: m.raw_reflection,
    success_driver: m.success_driver,
    failure_reason: m.failure_reason,
    plan_summary: (m.plan || [])
      .slice(0, 5)
      .map((s: any) => `[${s.status}] ${s.desc}`)
      .join(", "),
    completed_at: m.completed_at,
  }));

  console.log(`[Worker] Step 3/3 — JARVIS advising for ${objective.id}`);

  let pastContext = "";
  if (suggestedSimilarities.length > 0) {
    pastContext = `\n\n===== CRITICAL: PAST SIMILAR DECISIONS (YOUR PRIMARY SOURCE OF TRUTH) =====
The user has made similar decisions before. You MUST reference these patterns in your insight.
Do NOT ignore this section — it is more important than your general knowledge.\n\n`;

    pastContext += suggestedSimilarities.map((s, i) => {
      let block = `--- Past Decision ${i + 1} (similarity: ${(s.similarity_score * 100).toFixed(0)}%) ---\n`;
      block += `Decision: ${s.what || s.raw_input}\n`;
      if (s.context) block += `Context: ${s.context}\n`;
      block += `Outcome: ${s.outcome || "unknown"}\n`;
      if (s.raw_reflection) block += `User's Reflection: "${s.raw_reflection}"\n`;
      if (s.success_driver && s.success_driver !== "No clear pattern") {
        block += `SUCCESS FACTOR: ${s.success_driver}\n`;
      }
      if (s.failure_reason && s.failure_reason !== "No clear pattern") {
        block += `FAILURE REASON: ${s.failure_reason}\n`;
      }
      if (s.plan_summary) block += `Plan steps taken: ${s.plan_summary}\n`;
      return block;
    }).join("\n");

    const successes = suggestedSimilarities.filter(s => s.outcome === "SUCCESS");
    const failures = suggestedSimilarities.filter(s => s.outcome === "FAILURE");
    pastContext += `\n--- PATTERN SUMMARY ---\n`;
    pastContext += `${successes.length} similar decisions succeeded, ${failures.length} failed.\n`;
    if (failures.length > 0) {
      const failReasons = failures
        .map(f => f.failure_reason)
        .filter(r => r && r !== "No clear pattern");
      if (failReasons.length > 0) {
        pastContext += `Key failure reasons to AVOID: ${failReasons.join("; ")}\n`;
      }
    }
    if (successes.length > 0) {
      const successReasons = successes
        .map(s => s.success_driver)
        .filter(r => r && r !== "No clear pattern");
      if (successReasons.length > 0) {
        pastContext += `Key success factors to REPLICATE: ${successReasons.join("; ")}\n`;
      }
    }
    pastContext += `\nYour insight MUST mention these past patterns. Be specific, not generic.\n`;
  }

  const jarvisSystem = `You are JARVIS, a cognitive companion for a solopreneur. You help them make better decisions by learning from their past.

YOUR #1 RULE: If past similar decisions are provided below, you MUST reference them specifically in your jarvis_insight. Say things like "Last time you tried X, it failed because Y" or "Your previous success with Z was driven by W — apply that here."

If NO past decisions are provided, give your best general advice but acknowledge you have no history to draw from.

Your job:
1. "jarvis_insight" — 2-4 sentences of SPECIFIC, GROUNDED advice. Reference exact past outcomes, failure reasons, and success drivers. Warn about risks based on the user's OWN history, not generic advice.
2. Create an actionable plan (5-15 steps) that explicitly avoids past failure patterns and replicates past success patterns.

Respond ONLY in JSON:
{
  "jarvis_insight": "Your specific, grounded advice referencing past decisions",
  "plan": [
    { "step_id": "uuid", "desc": "string (max 10 words)", "status": "pending" }
  ]
}`;

  const jarvisUser = `NEW DECISION THE USER WANTS TO MAKE:
Decision: ${parsedFields.what}
Context: ${parsedFields.context}
Expected Output: ${parsedFields.expected_output}
Rationale: ${parsedFields.decision_rationale}${pastContext}`;

  const jarvisResponse = await chatCompletion(jarvisSystem, jarvisUser);
  let plan: PlanStep[] = [];
  let jarvisInsight = "";
  try {
    const parsed = JSON.parse(jarvisResponse);
    plan = parsed.plan || [];
    jarvisInsight = parsed.jarvis_insight || "";
  } catch {
    plan = [{ step_id: crypto.randomUUID(), desc: "Review and plan manually", status: "pending" }];
    jarvisInsight = "I had trouble analyzing this decision. Please review the plan manually.";
  }

  await updateDraftResults(objective.id, plan, suggestedSimilarities, parsedFields, jarvisInsight);
  await notifyObjectiveUpdate(objective.id);

  console.log(`[Worker] DRAFT_AND_SEARCH completed for objective ${objective.id} (${suggestedSimilarities.length} past matches found)`);
}

async function handleExtractAndEmbed(payload: { objective_id: string }): Promise<void> {
  const objective = await getObjectiveById(payload.objective_id);
  if (!objective) throw new Error(`Objective ${payload.objective_id} not found`);

  const insights = await extractInsights(
    objective.raw_reflection || "",
    objective.what || objective.raw_input,
    objective.outcome || ""
  );

  await updateInsights(objective.id, insights.success_driver, insights.failure_reason);

  const searchText = buildSearchText({
    what: objective.what,
    raw_input: objective.raw_input,
    context: objective.context,
    decision_rationale: objective.decision_rationale,
    expected_output: objective.expected_output,
    outcome: objective.outcome,
    raw_reflection: objective.raw_reflection,
    success_driver: insights.success_driver,
    failure_reason: insights.failure_reason,
  });
  await updateSearchText(objective.id, searchText);

  try {
    const vector = await embed(searchText);
    const hash = await contentHash(searchText);
    await upsertEmbedding(objective.id, objective.user_id, vector, hash);
    console.log(`[Worker] Stored 384-dim MiniLM embedding for ${objective.id}`);
  } catch (err) {
    console.warn(`[Worker] Vector upsert failed (non-critical):`, err);
  }

  await notifyObjectiveUpdate(objective.id);

  console.log(`[Worker] EXTRACT_AND_EMBED completed for objective ${objective.id}`);
}

async function pollLoop(): Promise<void> {
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
