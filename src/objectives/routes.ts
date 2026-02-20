import { Router, Request, Response } from "express";
import {
  createObjective,
  fetchObjective,
  fetchObjectivesByUser,
  confirmObjectivePlan,
  updateObjectivePlan,
  completeObjectiveFlow,
  fastTrackObjective,
  deleteObjective,
  chatAboutPlan,
} from "./service.js";
import { registerSSEClient } from "../core/sse.js";

const router = Router();

function getUserId(req: Request): string {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) throw new Error("x-user-id header is required");
  return userId;
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const id = await createObjective(userId, req.body);
    res.status(202).json({ id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/:id/stream", async (req: Request, res: Response) => {
  try {
    const objectiveId = req.params.id as string;
    registerSSEClient(objectiveId, res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const objectives = await fetchObjectivesByUser(userId);
    res.json(objectives);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

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

router.post("/:id/confirm", async (req: Request, res: Response) => {
  try {
    await confirmObjectivePlan(req.params.id as string, req.body.plan);
    res.json({ message: "Plan confirmed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id/plan", async (req: Request, res: Response) => {
  try {
    await updateObjectivePlan(req.params.id as string, req.body.plan);
    res.json({ message: "Plan updated" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

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

router.post("/:id/fast-track", async (req: Request, res: Response) => {
  try {
    await fastTrackObjective(
      req.params.id as string,
      req.body.outcome,
      req.body.raw_reflection
    );
    res.json({ message: "Objective fast-tracked to completion" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await deleteObjective(req.params.id as string);
    res.json({ message: "Objective deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/chat", async (req: Request, res: Response) => {
  try {
    const result = await chatAboutPlan(req.params.id as string, req.body.messages || []);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
