import "server-only";
import { intelligenceConfig } from "./config";

export type EmbedInputType = "document" | "query";

/** Génère des embeddings (Voyage AI ou OpenAI selon EMBEDDINGS_MODEL). */
export async function embedTexts(
  texts: string[],
  inputType: EmbedInputType = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddingsApiKey, embeddingsModel, embeddingDimensions } =
    intelligenceConfig();

  if (!embeddingsApiKey) {
    throw new Error(
      "EMBEDDINGS_API_KEY absente. Ajoutez-la dans .env.local ou les secrets Cursor."
    );
  }

  const model = embeddingsModel || "voyage-3";
  const isOpenAI =
    model.startsWith("text-embedding") || model.includes("openai");

  if (isOpenAI) {
    return embedOpenAI(texts, model, embeddingsApiKey);
  }

  const vectors = await embedVoyage(texts, model, embeddingsApiKey, inputType);
  for (const v of vectors) {
    if (v.length !== embeddingDimensions) {
      throw new Error(
        `Dimension embedding ${v.length} ≠ ${embeddingDimensions} (vérifiez EMBEDDINGS_MODEL / migration 001).`
      );
    }
  }
  return vectors;
}

async function embedVoyage(
  texts: string[],
  model: string,
  apiKey: string,
  inputType: EmbedInputType
): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      input_type: inputType,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.detail ?? json?.message ?? JSON.stringify(json).slice(0, 200);
    throw new Error(`Voyage embeddings ${res.status}: ${msg}`);
  }

  const data: { embedding: number[] }[] = json?.data ?? [];
  return data.map((d) => d.embedding);
}

async function embedOpenAI(
  texts: string[],
  model: string,
  apiKey: string
): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? JSON.stringify(json).slice(0, 200);
    throw new Error(`OpenAI embeddings ${res.status}: ${msg}`);
  }

  const data: { index: number; embedding: number[] }[] = json?.data ?? [];
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Format pgvector pour postgres.js */
export function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
