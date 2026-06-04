#!/usr/bin/env node
/**
 * Applique les migrations SQL (avec suivi schema_migrations).
 * Charge automatiquement .env.local — inutile d'exporter DATABASE_URL à la main.
 *
 * Usage : npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { loadEnvFiles, postgresOptions } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

loadEnvFiles();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(`
❌ DATABASE_URL introuvable.

1. Créez .env.local à la racine du projet (copiez .env.example)
2. Ajoutez votre connection string Postgres, par ex. Supabase :
   DATABASE_URL=postgresql://postgres.[ref]:[MOT_DE_PASSE]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

3. Relancez : npm run db:migrate

Diagnostic : npm run db:check
`);
  process.exit(1);
}

const sql = postgres(url, postgresOptions(url));

/** Découpe le SQL en statements (ignore les commentaires seuls). */
function splitStatements(body) {
  return body
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((l) => !l.trim() || l.trim().startsWith("--")));
}

async function ensureMigrationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

async function isApplied(filename) {
  const rows = await sql`
    SELECT 1 FROM schema_migrations WHERE filename = ${filename} LIMIT 1
  `;
  return rows.length > 0;
}

async function markApplied(filename) {
  await sql`
    INSERT INTO schema_migrations (filename) VALUES (${filename})
    ON CONFLICT (filename) DO NOTHING
  `;
}

async function main() {
  console.log("→ Connexion Postgres…");
  const [{ now }] = await sql`SELECT now() AS now`;
  console.log(`  Connecté (serveur : ${now})`);

  await ensureMigrationsTable();

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`→ ${files.length} fichier(s) de migration`);

  for (const file of files) {
    if (await isApplied(file)) {
      console.log(`  ○ ${file} (déjà appliquée)`);
      continue;
    }

    const path = join(migrationsDir, file);
    const body = readFileSync(path, "utf8");
    const statements = splitStatements(body);

    console.log(`  • ${file} (${statements.length} statement(s))`);

    try {
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
      await markApplied(file);
    } catch (err) {
      console.error(`\n❌ Échec sur ${file}:`);
      console.error(err instanceof Error ? err.message : err);
      console.error(`
Pistes courantes :
  • Supabase : activer l'extension "vector" dans Database → Extensions
  • Utiliser le mot de passe DB (pas la clé anon/service Notion)
  • Session pooler : port 5432 ; Transaction pooler : port 6543 (+ prepare: false, géré auto)
  • URL entre guillemets dans .env.local si le mot de passe contient des caractères spéciaux
  • npm run db:check pour un diagnostic détaillé
`);
      process.exit(1);
    }
  }

  console.log("\n✓ Migrations terminées.");
  await sql.end();
}

main().catch((err) => {
  console.error("\n❌ Connexion impossible :");
  console.error(err instanceof Error ? err.message : err);
  console.error("\nLancez : npm run db:check\n");
  process.exit(1);
});
