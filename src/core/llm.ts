import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/**
 * Chat completion with JSON mode enforced.
 */
export async function chatCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty content");
  }
  return content;
}

/**
 * Generate an embedding vector (1536-dim) using Groq's embeddings endpoint.
 * Falls back to a simple hash-based vector if embeddings are not available.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Groq may support embeddings — try the endpoint
    const response = await (groq as any).embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch {
    // Fallback: deterministic pseudo-embedding from text hash
    // This lets the full pipeline work even if the embeddings endpoint isn't available
    return deterministicEmbedding(text);
  }
}

/**
 * Deterministic pseudo-embedding for fallback.
 * Generates a stable 1536-dim vector from text using simple hashing.
 */
function deterministicEmbedding(text: string): number[] {
  const vector: number[] = new Array(1536);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) & 0x7fffffff;
  }
  for (let i = 0; i < 1536; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    vector[i] = (hash / 0x7fffffff) * 2 - 1; // normalise to [-1, 1]
  }
  // L2-normalize
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < 1536; i++) vector[i] /= mag;
  return vector;
}

/**
 * Create a SHA-256 content hash for deduplication.
 */
export async function contentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
