import { query } from "../core/db.js";
import { embed } from "./embeddings.js";

export interface SimilarMatch {
  objective_id: string;
  similarity_score: number;
  what: string | null;
  raw_input: string;
  context: string | null;
  expected_output: string | null;
  decision_rationale: string | null;
  outcome: string | null;
  raw_reflection: string | null;
  success_driver: string | null;
  failure_reason: string | null;
  plan: object[];
  completed_at: string | null;
}

const MIN_COSINE_SIM = 0.35;
const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

export async function findSimilarPastDecisions(
  searchText: string,
  userId: string,
  excludeObjectiveId?: string,
  limit: number = 5
): Promise<SimilarMatch[]> {
  const text = searchText.trim();
  if (!text) return [];

  const queryVec = await embed(text);
  const vecStr = `[${queryVec.join(",")}]`;

  const params: unknown[] = [
    vecStr,
    userId,
    MIN_COSINE_SIM,
    text,
    VECTOR_WEIGHT,
    KEYWORD_WEIGHT
  ];

  let excludeClause = "";
  if (excludeObjectiveId) {
    excludeClause = `AND o.id != $${params.length + 1}`;
    params.push(excludeObjectiveId);
  }
  const limitIdx = params.length + 1;
  params.push(limit);

  const sql = `
    WITH vector_matches AS (
      SELECT
        e.objective_id,
        (1.0 - (e.vector <=> $1::vector)) AS cosine_sim
      FROM objective_embeddings e
      WHERE e.user_id = $2
      ORDER BY e.vector <=> $1::vector ASC
      LIMIT $${limitIdx} * 4
    )
    SELECT
      o.id AS objective_id,
      vm.cosine_sim AS similarity_score,
      ($5::float * vm.cosine_sim +
       $6::float * COALESCE(similarity(o.search_text, $4), 0)
      ) AS hybrid_score,
      o.what, o.raw_input, o.context, o.expected_output, o.decision_rationale,
      o.outcome, o.raw_reflection, o.success_driver, o.failure_reason,
      o.plan, o.completed_at
    FROM vector_matches vm
    INNER JOIN objectives o ON o.id = vm.objective_id
    WHERE o.status = 'COMPLETED'
      AND o.is_deleted = false
      AND vm.cosine_sim >= $3
      ${excludeClause}
    ORDER BY hybrid_score DESC
    LIMIT $${limitIdx}
  `;

  const result = await query(sql, params);
  return result.rows;
}

export function buildSearchText(fields: {
  what?: string | null;
  raw_input?: string;
  context?: string | null;
  decision_rationale?: string | null;
  expected_output?: string | null;
  outcome?: string | null;
  raw_reflection?: string | null;
  success_driver?: string | null;
  failure_reason?: string | null;
}): string {
  const primary = fields.what || fields.raw_input || "";
  return [
    primary,
    primary,
    fields.context,
    fields.decision_rationale,
    fields.expected_output,
    fields.outcome,
    fields.raw_reflection,
    fields.success_driver,
    fields.failure_reason,
  ]
    .filter(Boolean)
    .join(" . ")
    .slice(0, 2000);
}

export function buildQueryText(fields: {
  what?: string | null;
  context?: string | null;
  decision_rationale?: string | null;
}): string {
  return [fields.what, fields.context, fields.decision_rationale]
    .filter(Boolean)
    .join(" . ")
    .slice(0, 800);
}

export async function updateSearchText(
  objectiveId: string,
  searchText: string
): Promise<void> {
  await query(
    `UPDATE objectives SET search_text = $1, updated_at = NOW() WHERE id = $2`,
    [searchText, objectiveId]
  );
}
