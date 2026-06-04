-- Sprint S0 — Fondations Intelligence (Postgres + pgvector)
-- Exécuter via : npm run db:migrate (nécessite DATABASE_URL)

-- Supabase : activer « vector » dans Database → Extensions si cette ligne échoue.
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Phase 6 — RAG (tables prêtes, ingestion en S1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  sector TEXT,
  account_url TEXT,
  outcome TEXT,
  raw_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding vector(1024),
  chunk_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_doc_id_idx ON knowledge_chunks(doc_id);
-- Index vectoriel : migration 002 (évite les échecs si pgvector/HNSW indisponible)

-- ---------------------------------------------------------------------------
-- Phase 6.3 — Journal de compte (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_url TEXT NOT NULL,
  account_id TEXT,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'notion_sync'
);

CREATE INDEX IF NOT EXISTS account_journal_account_url_idx ON account_journal(account_url);
CREATE INDEX IF NOT EXISTS account_journal_account_id_idx ON account_journal(account_id);
CREATE INDEX IF NOT EXISTS account_journal_event_date_idx ON account_journal(event_date DESC);

-- ---------------------------------------------------------------------------
-- Phase 7 — Scoring apprenant (tables prêtes, logique en S7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_url TEXT NOT NULL,
  account_id TEXT,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score NUMERIC,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS score_history_account_url_idx ON score_history(account_url);

CREATE TABLE IF NOT EXISTS outcome_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_url TEXT,
  account_id TEXT,
  opp_url TEXT,
  outcome TEXT NOT NULL,
  amount_keur NUMERIC,
  closed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Jobs asynchrones (enrichissement, veille, ingestion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intelligence_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT intelligence_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS intelligence_jobs_status_created_idx
  ON intelligence_jobs(status, created_at);
