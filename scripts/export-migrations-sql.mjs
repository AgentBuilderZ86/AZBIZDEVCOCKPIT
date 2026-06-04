#!/usr/bin/env node
/**
 * Concatène toutes les migrations pour collage dans Supabase → SQL Editor.
 * Usage : node scripts/export-migrations-sql.mjs > supabase-manual.sql
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log("-- Cockpit Intelligence — SQL manuel (Supabase / Neon)\n");
for (const file of files) {
  console.log(`-- ========== ${file} ==========\n`);
  console.log(readFileSync(join(dir, file), "utf8").trim());
  console.log("\n");
}
