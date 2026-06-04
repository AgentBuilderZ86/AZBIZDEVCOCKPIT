#!/usr/bin/env bash
# Provisionne Postgres + pgvector en local (Ubuntu/Debian) et écrit .env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Installation Postgres + pgvector (sudo)…"
sudo apt-get update -qq
sudo apt-get install -y postgresql postgresql-contrib postgresql-16-pgvector

echo "→ Démarrage du cluster…"
sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start

sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cockpit') THEN
    CREATE USER cockpit WITH PASSWORD 'cockpit_dev_local';
  END IF;
END $$;
SELECT 'CREATE DATABASE cockpit_intelligence OWNER cockpit'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cockpit_intelligence')\gexec
SQL

sudo -u postgres psql -d cockpit_intelligence -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO cockpit;
SQL

cat > .env.local <<'ENV'
# Postgres local — généré par scripts/provision-local-db.sh
DATABASE_URL=postgresql://cockpit:cockpit_dev_local@127.0.0.1:5432/cockpit_intelligence
CRON_SECRET=local-dev-cron-secret-change-in-prod
ENV

echo "→ Migrations…"
npm run db:migrate

echo ""
echo "✓ Base locale prête. Test : npm run db:check"
echo "  Health API : curl http://localhost:3000/api/intelligence/health"
