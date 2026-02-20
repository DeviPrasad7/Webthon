import { Router, Request, Response } from "express";
import { query } from "../core/db.js";
import { findSimilarObjectives } from "./vector.js";
import { generateEmbedding } from "../core/llm.js";

const router = Router();

function getUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) throw new Error("x-user-id header is required");
  return userId;
}

/**
 * GET /api/memory/dashboard
 * Returns top failure patterns, success patterns, and recent completed objectives.
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    // Top failure patterns
    const failurePatterns = await query(
      `SELECT failure_reason, COUNT(*) as count 
       FROM objectives 
       WHERE user_id = $1 AND failure_reason IS NOT NULL AND failure_reason != 'No clear pattern'
       GROUP BY failure_reason ORDER BY count DESC LIMIT 3`,
      [userId]
    );

    // Top success patterns
    const successPatterns = await query(
      `SELECT success_driver, COUNT(*) as count 
       FROM objectives 
       WHERE user_id = $1 AND success_driver IS NOT NULL AND success_driver != 'No clear pattern'
       GROUP BY success_driver ORDER BY count DESC LIMIT 3`,
      [userId]
    );

    // Recent completed objectives
    const recentCompleted = await query(
      `SELECT id, what, outcome, success_driver, failure_reason, completed_at
       FROM objectives
       WHERE user_id = $1 AND status = 'COMPLETED' AND is_deleted = false
       ORDER BY completed_at DESC LIMIT 5`,
      [userId]
    );

    // Summary counts
    const stats = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
         COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
         COUNT(*) FILTER (WHERE status = 'PLANNING') as planning,
         COUNT(*) FILTER (WHERE outcome = 'SUCCESS') as successes,
         COUNT(*) FILTER (WHERE outcome = 'FAILURE') as failures,
         COUNT(*) FILTER (WHERE outcome = 'PARTIAL') as partials
       FROM objectives
       WHERE user_id = $1 AND is_deleted = false`,
      [userId]
    );

    res.json({
      failure_patterns: failurePatterns.rows,
      success_patterns: successPatterns.rows,
      recent_completed: recentCompleted.rows,
      stats: stats.rows[0],
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/memory/search
 * Semantic search across past objectives.
 */
router.post("/search", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { text } = req.body;
    if (!text?.trim()) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const vector = await generateEmbedding(text.trim());
    const similar = await findSimilarObjectives(vector, userId, undefined, 5);

    // Fetch full objective details for matches
    if (similar.length === 0) {
      res.json({ results: [] });
      return;
    }

    const ids = similar.map((s) => s.objective_id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const details = await query(
      `SELECT id, what, context, outcome, success_driver, failure_reason
       FROM objectives
       WHERE id IN (${placeholders}) AND is_deleted = false`,
      ids
    );

    // Merge distance info
    const results = details.rows.map((row: any) => {
      const match = similar.find((s) => s.objective_id === row.id);
      return { ...row, distance: match?.distance };
    });

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
