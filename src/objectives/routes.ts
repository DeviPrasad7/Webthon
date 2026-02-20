import { Router, Request, Response } from "express";
import {
  createObjective,
  fetchObjective,
  fetchObjectivesByUser,
  confirmObjectivePlan,
  updateObjectivePlan,
  completeObjectiveFlow,
  deleteObjective,
} from "./service.js";
import { registerSSEClient } from "../core/sse.js";

const router = Router();

// Temporary: extract user_id from header (replace with auth middleware)
function getUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) throw new Error("x-user-id header is required");
  return userId;
}

/**
 * POST /api/objectives
 * Create a new objective.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = await createObjective(userId, req.body);
    res.status(202).json({ id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/objectives/:id/stream
 * SSE stream for real-time updates.
 */
router.get("/:id/stream", async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.id as string;
    registerSSEClient(objectiveId, res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/objectives
 * List all objectives for the user.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const objectives = await fetchObjectivesByUser(userId);
    res.json(objectives);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/objectives/:id
 * Fetch a single objective with dynamic progress.
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const obj = await fetchObjective(req.params.id as string);
    if (!obj) {
      res.status(404).json({ error: "Objective not found" });
      return;
    }
    res.json(obj);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/objectives/:id/confirm
 * Confirm the drafted plan.
 */
router.post("/:id/confirm", async (req: Request, res: Response) => {
  try {
    await confirmObjectivePlan(req.params.id as string, req.body.plan);
    res.json({ message: "Plan confirmed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * PUT /api/objectives/:id/plan
 * Update plan execution progress.
 */
router.put("/:id/plan", async (req: Request, res: Response) => {
  try {
    await updateObjectivePlan(req.params.id as string, req.body.plan);
    res.json({ message: "Plan updated" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/objectives/:id/complete
 * Complete an objective.
 */
router.post("/:id/complete", async (req: Request, res: Response) => {
  try {
    await completeObjectiveFlow(
      req.params.id as string,
      req.body.outcome,
      req.body.raw_reflection
    );
    res.json({ message: "Objective completed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * DELETE /api/objectives/:id
 * Soft delete an objective.
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await deleteObjective(req.params.id as string);
    res.json({ message: "Objective deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
