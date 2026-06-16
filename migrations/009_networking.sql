-- Migration 009 : Zone Networking
-- Catalogue d'événements locaux (Maroc) et annuaire d'associations professionnelles,
-- alimentés par recherche web IA (jobs networking.events / networking.associations).

CREATE TABLE IF NOT EXISTS networking_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  name            TEXT        NOT NULL,
  event_type      TEXT        NOT NULL DEFAULT '',   -- salon | petit-déjeuner | forum | corporate | conférence …
  organizer       TEXT        NOT NULL DEFAULT '',
  location        TEXT        NOT NULL DEFAULT '',
  city            TEXT        NOT NULL DEFAULT '',
  event_date      DATE,
  end_date        DATE,
  description     TEXT        NOT NULL DEFAULT '',
  website_url     TEXT,
  source_url      TEXT,
  sector          TEXT        NOT NULL DEFAULT '',
  audience        TEXT        NOT NULL DEFAULT '',
  relevance_score INTEGER,                            -- 1-10
  relevance_notes TEXT        NOT NULL DEFAULT '',

  status          TEXT        NOT NULL DEFAULT 'new',  -- new | saved | dismissed
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dédup applicative par nom + date (un même événement re-trouvé n'est pas dupliqué)
CREATE UNIQUE INDEX IF NOT EXISTS networking_events_name_date_idx
  ON networking_events(lower(name), COALESCE(event_date, '0001-01-01'::date));
CREATE INDEX IF NOT EXISTS networking_events_event_date_idx ON networking_events(event_date);
CREATE INDEX IF NOT EXISTS networking_events_sector_idx     ON networking_events(sector);

CREATE TABLE IF NOT EXISTS networking_associations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  name            TEXT        NOT NULL,
  assoc_type      TEXT        NOT NULL DEFAULT '',   -- chambre | fédération | club business | ONG | ordre …
  sector          TEXT        NOT NULL DEFAULT '',
  city            TEXT        NOT NULL DEFAULT '',
  website_url     TEXT,
  linkedin_url    TEXT,
  description     TEXT        NOT NULL DEFAULT '',
  membership_info TEXT        NOT NULL DEFAULT '',
  why_relevant    TEXT        NOT NULL DEFAULT '',
  key_contact     JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- { nom, titre, email, linkedin }

  status          TEXT        NOT NULL DEFAULT 'new',  -- new | saved | dismissed
  discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  job_id          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS networking_associations_name_idx
  ON networking_associations(lower(name));
CREATE INDEX IF NOT EXISTS networking_associations_sector_idx ON networking_associations(sector);
