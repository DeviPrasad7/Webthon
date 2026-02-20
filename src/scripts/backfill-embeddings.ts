import dotenv from "dotenv";
dotenv.config();

import { query } from "../core/db.js";
import { runMigrations } from "../core/db.js";
import { embed } from "../memory/embeddings.js";
import { buildSearchText } from "../memory/retrieval.js";
import { upsertEmbedding } from "../memory/vector.js";
import { contentHash } from "../core/llm.js";

async function main() {
  console.log("[Backfill] Running migrations first...");
  await runMigrations();

  const result = await query(`
    SELECT id, user_id, what, raw_input, context, decision_rationale,
           expected_output, outcome, raw_reflection, success_driver, failure_reason
    FROM objectives
    WHERE status = 'COMPLETED' AND is_deleted = false
    ORDER BY created_at
  `);

  console.log(`[Backfill] Found ${result.rows.length} completed objectives`);

  for (const row of result.rows) {
    const searchText = buildSearchText({
      what: row.what,
      raw_input: row.raw_input,
      context: row.context,
      decision_rationale: row.decision_rationale,
      expected_output: row.expected_output,
      outcome: row.outcome,
      raw_reflection: row.raw_reflection,
      success_driver: row.success_driver,
      failure_reason: row.failure_reason,
    });

    await query(
      `UPDATE objectives SET search_text = $1 WHERE id = $2`,
      [searchText, row.id]
    );

    console.log(`[Backfill] Embedding "${row.what?.slice(0, 50)}"...`);
    const vector = await embed(searchText);
    const hash = await contentHash(searchText);
    await upsertEmbedding(row.id, row.user_id, vector, hash);
    console.log(`[Backfill]   ✓ Stored 384-dim vector`);
  }

  console.log(`[Backfill] Done! ${result.rows.length} objectives embedded.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[Backfill] Fatal:", err);
  process.exit(1);
});
