import { query } from "../core/db.js";
import { extractInsights } from "../memory/insights.js";

async function main() {
  // Find completed objectives with "No clear pattern"
  const r = await query(
    `SELECT id, COALESCE(what, LEFT(raw_input,80)) as what, outcome, raw_reflection, success_driver, failure_reason 
     FROM objectives WHERE status = 'COMPLETED' AND is_deleted = false`
  );
  
  console.log(`Found ${r.rows.length} completed objectives\n`);

  for (const obj of r.rows) {
    const needsFix = 
      obj.success_driver === 'No clear pattern' || 
      obj.failure_reason === 'No clear pattern' ||
      !obj.success_driver ||
      !obj.failure_reason;

    if (needsFix) {
      console.log(`Re-extracting for: "${obj.what}" (${obj.outcome})`);
      const insights = await extractInsights(
        obj.raw_reflection || "",
        obj.what || "Unknown",
        obj.outcome || "SUCCESS"
      );
      console.log(`  success_driver: ${insights.success_driver}`);
      console.log(`  failure_reason: ${insights.failure_reason}\n`);

      await query(
        `UPDATE objectives SET success_driver = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`,
        [insights.success_driver, insights.failure_reason, obj.id]
      );
    } else {
      console.log(`OK: "${obj.what}" — ${obj.success_driver} / ${obj.failure_reason}`);
    }
  }

  console.log("\nDone! Verifying...");
  const check = await query(
    `SELECT COALESCE(what, LEFT(raw_input,50)) as what, outcome, success_driver, failure_reason 
     FROM objectives WHERE status = 'COMPLETED' AND is_deleted = false`
  );
  console.table(check.rows);
  process.exit(0);
}
main();
