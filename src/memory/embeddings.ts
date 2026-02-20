import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    console.log("[Embeddings] Loading MiniLM model (first time may download ~23 MB)...");
    extractor = await pipeline("feature-extraction", MODEL_NAME) as FeatureExtractionPipeline;
    console.log("[Embeddings] Model loaded ✓");
  }
  return extractor;
}

const CACHE_MAX = 256;
const embedCache = new Map<string, number[]>();

function cacheGet(key: string): number[] | undefined {
  const val = embedCache.get(key);
  if (val) {
    embedCache.delete(key);
    embedCache.set(key, val);
  }
  return val;
}

function cachePut(key: string, val: number[]): void {
  if (embedCache.size >= CACHE_MAX) {
    const firstKey = embedCache.keys().next().value;
    if (firstKey !== undefined) embedCache.delete(firstKey);
  }
  embedCache.set(key, val);
}

export async function embed(text: string): Promise<number[]> {
  const cached = cacheGet(text);
  if (cached) return cached;

  const ext = await getExtractor();
  const output = await ext(text, { pooling: "mean", normalize: true });
  const vec = Array.from(output.data as Float32Array);
  cachePut(text, vec);
  return vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const ext = await getExtractor();
  const results: number[][] = [];
  for (const text of texts) {
    const cached = cacheGet(text);
    if (cached) {
      results.push(cached);
      continue;
    }
    const output = await ext(text, { pooling: "mean", normalize: true });
    const vec = Array.from(output.data as Float32Array);
    cachePut(text, vec);
    results.push(vec);
  }
  return results;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export const EMBEDDING_DIM = 384;
