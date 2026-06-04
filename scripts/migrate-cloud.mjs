#!/usr/bin/env node
/**
 * Migration Supabase/Neon uniquement — n'utilise PAS .env.local (Postgres dev).
 * Lit DATABASE_URL depuis les secrets injectés par l'agent cloud.
 */
import { loadEnvFiles } from "./load-env.mjs";

// Ne charge pas .env.local
loadEnvFiles({ cloudOnly: true });

if (!process.env.DATABASE_URL?.trim()) {
  console.error(`
❌ DATABASE_URL absente du shell.

Les secrets Cursor sont injectés au démarrage de l'agent cloud :
  1. cursor.com → Cloud Agents → Secrets
  2. Nom exact : DATABASE_URL
  3. Type : « Environment Variable » ou « Runtime Secret » (pas « Build Secret »)
  4. Relancer un nouvel agent cloud après avoir ajouté le secret

Puis : npm run db:migrate:cloud
`);
  process.exit(1);
}

process.env.MIGRATE_CLOUD_ONLY = "1";
await import("./migrate.mjs");
