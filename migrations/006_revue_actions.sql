-- Migration 006 : Revue Actions — suivi des recommandations IA par compte
CREATE TABLE IF NOT EXISTS revue_actions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  compte_id       TEXT        NOT NULL,
  compte_nom      TEXT        NOT NULL DEFAULT '',
  action_text     TEXT        NOT NULL,
  target_contacts TEXT        NOT NULL DEFAULT '',   -- csv des contacts ciblés
  linked_offer    TEXT,
  horizon         TEXT        NOT NULL DEFAULT 'J+30', -- J+7 | J+30 | J+90 | J+180
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),  -- date de génération de l'analyse

  -- Résultat de la revue
  status          TEXT        NOT NULL DEFAULT 'pending', -- pending | done | skipped
  done_at         TIMESTAMPTZ,
  done_type       TEXT,        -- email | appel | reunion | autre
  done_contact    TEXT,
  done_notes      TEXT,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(compte_id, action_text)
);

CREATE INDEX IF NOT EXISTS revue_actions_status_idx   ON revue_actions(status);
CREATE INDEX IF NOT EXISTS revue_actions_compte_idx   ON revue_actions(compte_id);
CREATE INDEX IF NOT EXISTS revue_actions_horizon_idx  ON revue_actions(horizon);
