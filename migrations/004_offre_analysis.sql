-- Migration 004 : Analyse Offre par compte (Offre Mapping + Plan d'Action)

CREATE TABLE IF NOT EXISTS compte_offre_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id TEXT NOT NULL,
  compte_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mapping_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthese_narrative TEXT NOT NULL DEFAULT '',
  model_version TEXT NOT NULL DEFAULT 'claude-opus-4-8',
  rag_hit_count INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS compte_offre_analysis_compte_id_idx
  ON compte_offre_analysis (compte_id);

CREATE INDEX IF NOT EXISTS compte_offre_analysis_generated_at_idx
  ON compte_offre_analysis (generated_at DESC);
