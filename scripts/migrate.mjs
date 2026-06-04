#!/usr/bin/env node
/**
 * Applique les migrations SQL dans migrations/*.sql (ordre alphabétique).
 * Usage : DATABASE_URL=postgresql://... npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "migrations");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL manquante.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function main() {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`→ ${files.length} migration(s) à appliquer`);
  for (const file of files) {
    const path = join(migrationsDir, file);
    const body = readFileSync(path, "utf8");
    console.log(`  • ${file}`);
    await sql.unsafe(body);
  }
  console.log("✓ Migrations terminées.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
