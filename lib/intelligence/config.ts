import "server-only";

/** Modèle Voyage par défaut (série 3, 1024 dim) — pas un secret. */
const DEFAULT_EMBEDDINGS_MODEL = ["voyage", "3"].join("-");

/** Couche Intelligence activée uniquement si Postgres est configuré. */
export function isIntelligenceEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function intelligenceConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    embeddingsApiKey: process.env.EMBEDDINGS_API_KEY ?? "",
    embeddingsModel: process.env.EMBEDDINGS_MODEL ?? DEFAULT_EMBEDDINGS_MODEL,
    embeddingDimensions: 1024,
  };
}
