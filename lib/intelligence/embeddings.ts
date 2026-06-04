import "server-only";
import { intelligenceConfig } from "./config";

export type EmbedInputType = "document" | "query";

/** Chunks par appel Voyage (évite de dépasser ~10K TPM en compte sans carte). */
const VOYAGE_EMBED_BATCH_SIZE = Math.max(
  1,
  parseInt(process.env.VOYAGE_EMBED_BATCH_SIZE ?? "3", 10) || 3
);

/** Pause entre lots (ms). Mettre 21000 pour le palier gratuit 3 RPM sans carte bancaire. */
const VOYAGE_EMBED_BATCH_DELAY_MS = Math.max(
  0,
  parseInt(process.env.VOYAGE_EMBED_BATCH_DELAY_MS ?? "0", 10) || 0
);

const VOYAGE_MAX_RETRIES = 4;

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

  const model = embeddingsModel;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatVoyageError(status: number, raw: string): string {
  if (status === 429 && /payment method/i.test(raw)) {
    return (
      "Quota Voyage AI limité (compte sans carte bancaire : 3 requêtes/min, 10K tokens/min). " +
      "Ajoutez un moyen de paiement sur https://dashboard.voyageai.com/ (les 200M tokens gratuits restent actifs), " +
      "ou configurez VOYAGE_EMBED_BATCH_SIZE=3 et VOYAGE_EMBED_BATCH_DELAY_MS=21000 dans Netlify pour les gros PDF."
    );
  }
  if (status === 429) {
    return (
      `Quota Voyage AI dépassé (429). Réessayez dans une minute, ou réduisez la taille du document. Détail : ${raw.slice(0, 180)}`
    );
  }
  return `Voyage embeddings ${status}: ${raw.slice(0, 240)}`;
}

async function embedVoyage(
  texts: string[],
  model: string,
  apiKey: string,
  inputType: EmbedInputType
): Promise<number[][]> {
  const all: number[][] = [];

  for (let i = 0; i < texts.length; i += VOYAGE_EMBED_BATCH_SIZE) {
    if (i > 0 && VOYAGE_EMBED_BATCH_DELAY_MS > 0) {
      await sleep(VOYAGE_EMBED_BATCH_DELAY_MS);
    }
    const batch = texts.slice(i, i + VOYAGE_EMBED_BATCH_SIZE);
    const vectors = await embedVoyageOnce(batch, model, apiKey, inputType);
    all.push(...vectors);
  }

  return all;
}

async function embedVoyageOnce(
  texts: string[],
  model: string,
  apiKey: string,
  inputType: EmbedInputType
): Promise<number[][]> {
  let lastError = "Erreur inconnue.";

  for (let attempt = 0; attempt < VOYAGE_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(60_000, 20_000 * 2 ** (attempt - 1));
      await sleep(backoff);
    }

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
    if (res.ok) {
      const data: { embedding: number[] }[] = json?.data ?? [];
      return data.map((d) => d.embedding);
    }

    const raw =
      (typeof json?.detail === "string" ? json.detail : null) ??
      json?.message ??
      JSON.stringify(json).slice(0, 400);
    lastError = formatVoyageError(res.status, String(raw));

    if (res.status !== 429 || /payment method/i.test(String(raw))) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
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
