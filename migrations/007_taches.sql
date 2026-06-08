-- Migration 007 : Taches — TODO de la semaine & appels à réaliser (manuels)
-- Rattachables à un compte, un contact ou une opportunité, consolidées sur /semaine.
CREATE TABLE IF NOT EXISTS taches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id     TEXT        NOT NULL,
  compte_nom    TEXT        NOT NULL DEFAULT '',

  -- Rattachement fin optionnel
  scope         TEXT        NOT NULL DEFAULT 'compte',   -- compte | contact | opportunite
  cible_id      TEXT,                                     -- Notion page id du contact/opp ciblé
  cible_nom     TEXT        NOT NULL DEFAULT '',          -- nom dénormalisé (affichage)

  -- Contenu
  type          TEXT        NOT NULL DEFAULT 'todo',      -- todo | appel
  titre         TEXT        NOT NULL,
  notes         TEXT        NOT NULL DEFAULT '',
  priorite      TEXT        NOT NULL DEFAULT 'moyenne',   -- haute | moyenne | basse
  due_date      DATE,

  -- Suivi
  status        TEXT        NOT NULL DEFAULT 'pending',   -- pending | done
  done_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS taches_compte_idx ON taches(compte_id);
CREATE INDEX IF NOT EXISTS taches_status_idx ON taches(status);
CREATE INDEX IF NOT EXISTS taches_due_idx    ON taches(due_date);
