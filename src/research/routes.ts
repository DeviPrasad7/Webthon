import { Router, Request, Response } from "express";
import { searchWeb, researchObjective, type WebResearchResult } from "./tavily.js";
import { getObjectiveById } from "../objectives/queries.js";
import { chatCompletion } from "../core/llm.js";

const router = Router();

/**
 * POST /api/research/search
 * Body: { query: string }
 * Direct web search — used for manual "Deep Research" from the UI.
 */
router.post("/search", async (req: Request, res: Response) => {
  try {
    const { query: searchQuery } = req.body;
    if (!searchQuery?.trim()) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const result = await searchWeb(searchQuery.trim(), 5);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/research/objective/:id
 * Trigger a full web research for an existing objective,
 * then return an LLM-synthesized intelligence brief.
 */
router.post("/objective/:id", async (req: Request, res: Response) => {
  try {
    const objective = await getObjectiveById(req.params.id as string);
    if (!objective) {
      res.status(404).json({ error: "Objective not found" });
      return;
    }

    const fields = {
      what: objective.what || objective.raw_input.slice(0, 200),
      context: objective.context || undefined,
      expected_output: objective.expected_output || undefined,
      decision_rationale: objective.decision_rationale || undefined,
    };

    // Perform multi-angle web research
    const results = await researchObjective(fields);

    // Flatten sources for the response
    const allSources = results.flatMap((r) => r.sources);
    const allAnswers = results
      .map((r) => r.answer)
      .filter((a) => a !== "No synthesized answer available." && a !== "Web research unavailable at this time.");

    // Use LLM to synthesize a strategic intelligence brief
    const synthesisPrompt = `You are JARVIS, a cognitive companion. Synthesize the following web research into a concise strategic intelligence brief for this decision.

DECISION: ${fields.what}
${fields.context ? `CONTEXT: ${fields.context}` : ""}

WEB RESEARCH FINDINGS:
${allAnswers.map((a, i) => `Finding ${i + 1}: ${a}`).join("\n")}

TOP SOURCES:
${allSources.slice(0, 8).map((s) => `• ${s.title}: ${s.snippet}`).join("\n")}

Respond in JSON:
{
  "brief": "2-4 sentence strategic intelligence brief synthesizing the web research. Be specific and actionable.",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "risks_identified": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}`;

    let synthesis;
    try {
      const raw = await chatCompletion(synthesisPrompt, "Synthesize the web research above.");
      synthesis = JSON.parse(raw);
    } catch {
      synthesis = {
        brief: allAnswers[0] || "Research completed. Review sources below.",
        key_insights: [],
        risks_identified: [],
        opportunities: [],
      };
    }

    res.json({
      synthesis,
      sources: allSources,
      queries: results.map((r) => r.query),
      searched_at: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
