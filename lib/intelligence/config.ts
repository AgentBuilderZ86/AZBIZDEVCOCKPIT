import "server-only";

/** Couche Intelligence activée uniquement si Postgres est configuré. */
export function isIntelligenceEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function intelligenceConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    embeddingsApiKey: process.env.EMBEDDINGS_API_KEY ?? "",
    embeddingsModel: process.env.EMBEDDINGS_MODEL ?? "voyage-3",
    embeddingDimensions: 1024,
  };
}
