-- Migration 005 : Pipeline AO (Appels d'Offres)
-- Tables indépendantes des opportunités Notion — isolation totale des stats

CREATE TABLE IF NOT EXISTS ao_import_batches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name     TEXT        NOT NULL,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ao_count      INTEGER     NOT NULL DEFAULT 0,
  qualify_job_id TEXT       DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS ao_submissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID        REFERENCES ao_import_batches(id) ON DELETE CASCADE,

  -- Contenu extrait du fichier
  titre           TEXT        NOT NULL DEFAULT '',
  client          TEXT        NOT NULL DEFAULT '',
  date_publication DATE,
  deadline        DATE,
  budget_k_eur    NUMERIC,
  description     TEXT        NOT NULL DEFAULT '',
  source_url      TEXT        NOT NULL DEFAULT '',
  secteur         TEXT        NOT NULL DEFAULT '',

  -- Qualification IA (remplie par job ao.qualify)
  score_fit       INTEGER,               -- 1-10
  synthese        TEXT        NOT NULL DEFAULT '',
  suggestion      TEXT        NOT NULL DEFAULT '',  -- 'Go' | 'NoGo' | ''

  -- Pipeline statut
  statut          TEXT        NOT NULL DEFAULT 'BO',
  -- Valeurs : BO | BO_GO | BO_NOGO | P2P | PP | PW | PL

  -- Lien optionnel vers un Compte Notion
  compte_notion_id TEXT       NOT NULL DEFAULT '',
  compte_nom       TEXT       NOT NULL DEFAULT '',

  -- Notes libres
  notes           TEXT        NOT NULL DEFAULT '',

  -- Timestamps
  imported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ao_submissions_batch_id_idx  ON ao_submissions(batch_id);
CREATE INDEX IF NOT EXISTS ao_submissions_statut_idx    ON ao_submissions(statut);
CREATE INDEX IF NOT EXISTS ao_submissions_deadline_idx  ON ao_submissions(deadline);
