-- Migration 003 : Multi-utilisateur & rôles
-- Ajoute le suivi des acteurs dans account_journal
-- et une table de permissions par secteur.

-- Colonne user_id et user_email dans account_journal
ALTER TABLE account_journal
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Permissions par utilisateur × secteur
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  secteur TEXT NOT NULL,
  can_write BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clerk_user_id, secteur)
);

CREATE INDEX IF NOT EXISTS user_permissions_user_idx ON user_permissions (clerk_user_id);
