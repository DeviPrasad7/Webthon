import { tavily } from "@tavily/core";
import dotenv from "dotenv";

dotenv.config();

const client = tavily({ apiKey: process.env.TAVILY_API_KEY || "" });

export interface WebSource {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface WebResearchResult {
  query: string;
  answer: string;
  sources: WebSource[];
  searched_at: string;
}

/**
 * Perform a focused web search for a decision objective.
 * Returns an AI-generated answer + top sources.
 */
export async function searchWeb(
  searchQuery: string,
  maxResults: number = 5
): Promise<WebResearchResult> {
  try {
    const response = await client.search(searchQuery, {
      searchDepth: "advanced",
      maxResults,
      includeAnswer: true,
    });

    const sources: WebSource[] = (response.results || []).map((r: any) => ({
      title: r.title || "Untitled",
      url: r.url || "",
      snippet: r.content?.slice(0, 300) || "",
      score: r.score || 0,
    }));

    return {
      query: searchQuery,
      answer: response.answer || "No synthesized answer available.",
      sources,
      searched_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error("[Tavily] Search failed:", err.message);
    return {
      query: searchQuery,
      answer: "Web research unavailable at this time.",
      sources: [],
      searched_at: new Date().toISOString(),
    };
  }
}

/**
 * Given a parsed objective, generate smart search queries and aggregate results.
 * Returns multiple research angles for richer intelligence.
 */
export async function researchObjective(fields: {
  what: string;
  context?: string;
  expected_output?: string;
  decision_rationale?: string;
}): Promise<WebResearchResult[]> {
  // Build 2-3 smart queries from different angles
  const queries: string[] = [];

  // Primary: direct decision query
  queries.push(`best practices for: ${fields.what}`);

  // Secondary: context-aware query
  if (fields.context) {
    queries.push(`${fields.what} ${fields.context} tips and strategies`);
  }

  // Tertiary: risks and pitfalls
  queries.push(`common mistakes and risks when ${fields.what.toLowerCase()}`);

  // Execute searches in parallel (max 3 to save API quota)
  const results = await Promise.all(
    queries.slice(0, 3).map((q) => searchWeb(q, 3))
  );

  return results;
}

/**
 * Flatten multiple research results into a concise context block for the LLM.
 */
export function formatResearchForLLM(results: WebResearchResult[]): string {
  if (!results || results.length === 0) return "";

  let block = `\n\n===== LIVE WEB INTELLIGENCE (searched ${new Date().toISOString()}) =====\n`;
  block += `JARVIS searched the web for real-time context. Use this to enhance your advice.\n\n`;

  for (const result of results) {
    if (result.sources.length === 0 && result.answer === "Web research unavailable at this time.") continue;

    block += `--- Search: "${result.query}" ---\n`;
    if (result.answer && result.answer !== "No synthesized answer available.") {
      block += `Summary: ${result.answer}\n`;
    }
    for (const source of result.sources.slice(0, 3)) {
      block += `  • [${source.title}] ${source.snippet}\n`;
    }
    block += "\n";
  }

  block += `Use the above web intelligence to give SPECIFIC, CURRENT advice. Cite sources when relevant.\n`;
  return block;
}
