import dotenv from "dotenv";
dotenv.config();
import { query } from "../core/db.js";
import { embed } from "../memory/embeddings.js";
import { runMigrations } from "../core/db.js";

async function main() {
  await runMigrations();

  const searchText = "Opening a badminton equipment showroom with court facilities";
  console.log(`\nQuery: "${searchText}"\n`);

  const vec = await embed(searchText);
  const vecStr = `[${vec.join(",")}]`;

  const result = await query(`
    SELECT 
      LEFT(o.what, 55) AS what,
      o.outcome,
      ROUND((1.0 - (e.vector <=> $1::vector))::numeric, 4) AS cosine_sim
    FROM objectives o
    JOIN objective_embeddings e ON e.objective_id = o.id
    WHERE o.status = 'COMPLETED'
    ORDER BY e.vector <=> $1::vector ASC
  `, [vecStr]);

  console.table(result.rows);
  process.exit(0);
}

main().catch(console.error);
