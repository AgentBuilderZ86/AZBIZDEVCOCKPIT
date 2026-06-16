-- Migration 008 : Référencement Achats
-- Une ligne par compte (upsert) — moyen de contact de la direction des achats
-- + procédure de référencement fournisseur, recherchés via le web (job procurement.research).

CREATE TABLE IF NOT EXISTS account_procurement (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien vers le compte Notion
  account_id             TEXT        NOT NULL UNIQUE,   -- Notion page id
  account_url            TEXT        NOT NULL DEFAULT '',
  account_nom            TEXT        NOT NULL DEFAULT '',

  -- Coordonnées Achats / référencement
  email_achats           TEXT,
  achats_phone           TEXT,
  referencement_url      TEXT,                          -- page « devenir fournisseur »
  fournisseur_portal_url TEXT,                          -- portail / plateforme fournisseurs

  -- Procédure de référencement
  procedure_steps        JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- string[]
  synthese               TEXT        NOT NULL DEFAULT '',
  sources                JSONB       NOT NULL DEFAULT '[]'::jsonb,   -- string[] (URLs)
  confidence             TEXT        NOT NULL DEFAULT '',            -- haute | moyenne | faible

  -- Métadonnées
  status                 TEXT        NOT NULL DEFAULT 'pending',     -- pending | done | empty
  researched_at          TIMESTAMPTZ,
  job_id                 TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS account_procurement_account_id_idx
  ON account_procurement(account_id);
