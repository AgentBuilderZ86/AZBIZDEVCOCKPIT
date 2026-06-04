import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(path) {
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

/**
 * Charge les fichiers env sans écraser les secrets injectés par l'agent cloud.
 *
 * Ordre de priorité (du plus fort au plus faible) :
 * 1. process.env (Secrets Cursor / export shell)
 * 2. .env.cloud (optionnel, gitignored)
 * 3. .env
 * 4. .env.local / .env.local.dev — uniquement si USE_LOCAL_DB=1
 */
export function loadEnvFiles(options = {}) {
  const { cloudOnly = false } = options;

  if (cloudOnly) return;

  const cloudEnv = join(root, ".env.cloud");
  if (existsSync(cloudEnv)) parseEnvFile(cloudEnv);

  const dotEnv = join(root, ".env");
  if (existsSync(dotEnv)) parseEnvFile(dotEnv);

  const useLocal =
    process.env.USE_LOCAL_DB === "1" || process.env.USE_LOCAL_DB === "true";

  if (useLocal) {
    for (const name of [".env.local", ".env.local.dev"]) {
      const path = join(root, name);
      if (existsSync(path)) parseEnvFile(path);
    }
  }
}

/** True si DATABASE_URL vient des secrets cloud (Supabase/Neon), pas du Postgres local. */
export function isCloudDatabaseUrl(url) {
  const u = url.toLowerCase();
  return (
    u.includes("supabase.co") ||
    u.includes("neon.tech") ||
    u.includes("aws.neon.tech")
  );
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
