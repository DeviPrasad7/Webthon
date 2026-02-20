import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

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

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await (groq as any).embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch {
    return deterministicEmbedding(text);
  }
}

function deterministicEmbedding(text: string): number[] {
  const vector: number[] = new Array(1536);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) & 0x7fffffff;
  }
  for (let i = 0; i < 1536; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    vector[i] = (hash / 0x7fffffff) * 2 - 1;
  }
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  for (let i = 0; i < 1536; i++) vector[i] /= mag;
  return vector;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletionMultiTurn(
  messages: ChatMessage[],
  jsonMode: boolean = false
): Promise<string> {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    temperature: 0.4,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");
  return content;
}

export async function contentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
