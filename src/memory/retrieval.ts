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

/** Lowered from 0.65 — MiniLM on concatenated text rarely exceeds 0.7 for genuine matches */
const MIN_COSINE_SIM = 0.35;

/** Weight for vector similarity in the hybrid score (0-1) */
const VECTOR_WEIGHT = 0.7;
/** Weight for keyword similarity in the hybrid score (0-1) */
const KEYWORD_WEIGHT = 0.3;

/**
 * Hybrid retrieval: combines pgvector cosine similarity with
 * pg_trgm keyword similarity for better recall + precision.
 * Uses a CTE to avoid computing cosine distance twice.
 */
export async function findSimilarPastDecisions(
  searchText: string,
  userId: string,
  excludeObjectiveId?: string,
  limit: number = 5
): Promise<SimilarMatch[]> {
  const text = searchText.trim();
  if (!text) return [];

  // Build a query-focused embedding (emphasize the core decision)
  const queryVec = await embed(text);
  const vecStr = `[${queryVec.join(",")}]`;

  const params: unknown[] = [
    vecStr,         // $1 — query vector
    userId,         // $2 — user_id
    MIN_COSINE_SIM, // $3 — minimum cosine similarity
    text,           // $4 — raw text for trigram keyword matching
    VECTOR_WEIGHT,  // $5 — vector weight
    KEYWORD_WEIGHT, // $6 — keyword weight
  ];

  let excludeClause = "";
  if (excludeObjectiveId) {
    excludeClause = `AND o.id != $${params.length + 1}`;
    params.push(excludeObjectiveId);
  }
  const limitIdx = params.length + 1;
  params.push(limit);

  // CTE computes cosine_sim once; hybrid_score blends vector + keyword
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

/**
 * Build the text that gets STORED as an embedding for a completed objective.
 * Weights the 'what' field heavily (repeated) so vector search is anchored
 * to the core decision, not drowned out by verbose reflections.
 */
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
    primary, // anchor embedding to the core decision
    primary, // repeat for heavier weight
    fields.context,
    fields.decision_rationale,
    fields.expected_output,
    fields.outcome,
    fields.raw_reflection,
    fields.success_driver,
    fields.failure_reason,
  ]
    .filter(Boolean)
    .join(" . ") // sentence-boundary markers help MiniLM segment
    .slice(0, 2000);
}

/**
 * Build text for the QUERY side — focuses on the decision description
 * plus rationale. Keeps query tight so the embedding is discriminative.
 */
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
