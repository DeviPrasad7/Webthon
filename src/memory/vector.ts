import { query } from "../core/db.js";

export interface SimilarObjective {
  objective_id: string;
  distance: number;
}

/**
 * Exact nearest neighbor search using pgvector's <-> operator.
 * No HNSW/IVFFlat indexes — free-tier memory safe.
 */
export async function findSimilarObjectives(
  vector: number[],
  userId: string,
  excludeObjectiveId?: string,
  limit: number = 3
): Promise<SimilarObjective[]> {
  const vectorStr = `[${vector.join(",")}]`;

  let sql = `
    SELECT objective_id, (vector <-> $1::vector) as distance
    FROM objective_embeddings
    WHERE user_id = $2
  `;
  const params: unknown[] = [vectorStr, userId];

  if (excludeObjectiveId) {
    sql += ` AND objective_id != $3`;
    params.push(excludeObjectiveId);
  }

  sql += ` ORDER BY distance ASC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Upsert an objective embedding.
 */
export async function upsertEmbedding(
  objectiveId: string,
  userId: string,
  vector: number[],
  hash: string
): Promise<void> {
  const vectorStr = `[${vector.join(",")}]`;
  await query(
    `INSERT INTO objective_embeddings (objective_id, user_id, vector, content_hash)
     VALUES ($1, $2, $3::vector, $4)
     ON CONFLICT (objective_id)
     DO UPDATE SET vector = $3::vector, content_hash = $4, user_id = $2`,
    [objectiveId, userId, vectorStr, hash]
  );
}
