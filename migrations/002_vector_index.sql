-- Index HNSW pour la recherche sémantique (Phase 6).
-- Nécessite pgvector ≥ 0.5. En cas d'échec, l'app RAG fonctionnera sans index (scan séquentiel limité).

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
