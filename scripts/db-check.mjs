#!/usr/bin/env node
/**
 * Diagnostic connexion Postgres (sans modifier la base).
 * Usage : npm run db:check
 */
import postgres from "postgres";
import {
  loadEnvFiles,
  postgresOptions,
  isCloudDatabaseUrl,
} from "./load-env.mjs";

loadEnvFiles();

const url = process.env.DATABASE_URL?.trim();

console.log("=== Diagnostic Postgres (Cockpit Intelligence) ===\n");

if (!url) {
  console.log("❌ DATABASE_URL : absente");
  console.log("   → Renseignez-la dans .env.local à la racine du projet.\n");
  process.exit(1);
}

const masked = url.replace(/:([^:@/]+)@/, ":***@");
console.log("✓ DATABASE_URL : définie");
console.log(`  ${masked}`);
console.log(
  `  Cible : ${isCloudDatabaseUrl(url) ? "cloud (Supabase/Neon)" : process.env.USE_LOCAL_DB ? "local (USE_LOCAL_DB)" : "local ou autre"}\n`
);

if (url.includes("NOTION") || url.includes("notion")) {
  console.log("⚠️  L'URL ressemble à Notion, pas à Postgres.");
}

const opts = postgresOptions(url);
console.log("Options client :", JSON.stringify(opts, null, 2), "\n");

const sql = postgres(url, opts);

try {
  const [ver] = await sql`SELECT version() AS v`;
  console.log("✓ Connexion OK");
  console.log(`  ${ver.v.split(",")[0]}\n`);

  const ext = await sql`
    SELECT extname FROM pg_extension WHERE extname = 'vector'
  `;
  if (ext.length) {
    console.log("✓ Extension pgvector : installée");
  } else {
    console.log("⚠️  Extension pgvector : absente");
    console.log("   Supabase → Database → Extensions → activer « vector »");
    console.log("   Puis : npm run db:migrate\n");
  }

  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'account_journal',
        'intelligence_jobs',
        'knowledge_docs',
        'schema_migrations'
      )
    ORDER BY tablename
  `;
  if (tables.length) {
    console.log("Tables Intelligence :");
    for (const t of tables) console.log(`  ✓ ${t.tablename}`);
  } else {
    console.log("○ Tables Intelligence : pas encore créées → npm run db:migrate");
  }

  const cron = process.env.CRON_SECRET?.trim();
  console.log(`\nCRON_SECRET : ${cron ? "✓ défini" : "○ absent (OK en local, requis en prod Netlify)"}`);

  console.log("\n=== Fin diagnostic ===\n");
  await sql.end();
} catch (err) {
  console.error("❌ Connexion échouée :\n");
  console.error(err instanceof Error ? err.message : err);
  console.error(`
Vérifications :
  1. Projet Supabase actif (pas en pause)
  2. Mot de passe : Settings → Database → Reset database password
  3. Connection string : Settings → Database → URI (mode Session recommandé pour migrate)
  4. Caractères spéciaux dans le mot de passe → encoder en URL (%40 pour @, etc.)
  5. Firewall : « Restrict connections » désactivé ou votre IP autorisée
`);
  process.exit(1);
}
