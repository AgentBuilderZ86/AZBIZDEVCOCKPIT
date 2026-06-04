import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Charge .env puis .env.local (sans écraser les variables déjà définies). */
export function loadEnvFiles() {
  for (const name of [".env", ".env.local"]) {
    const path = join(root, name);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

/** Options postgres.js adaptées Supabase / Neon. */
export function postgresOptions(databaseUrl) {
  const url = databaseUrl.toLowerCase();
  const needsSsl =
    url.includes("supabase.co") ||
    url.includes("neon.tech") ||
    url.includes("sslmode=require") ||
    url.includes("ssl=true");
  const usesPooler = url.includes(":6543") || url.includes("pooler");
  return {
    max: 1,
    connect_timeout: 30,
    idle_timeout: 10,
    ...(needsSsl ? { ssl: "require" } : {}),
    ...(usesPooler ? { prepare: false } : {}),
  };
}
