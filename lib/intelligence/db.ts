import "server-only";
import postgres, { type Sql } from "postgres";
import { isIntelligenceEnabled } from "./config";

let sql: Sql | null = null;

/** Client Postgres lazy (server-only). Lève si DATABASE_URL absente. */
export function getDb(): Sql {
  if (!isIntelligenceEnabled()) {
    throw new Error(
      "DATABASE_URL absente : la couche Intelligence est désactivée. " +
        "Renseignez Postgres (Supabase/Neon) et exécutez npm run db:migrate."
    );
  }
  if (!sql) {
    const url = process.env.DATABASE_URL!;
    const lower = url.toLowerCase();
    const needsSsl =
      lower.includes("supabase.co") ||
      lower.includes("neon.tech") ||
      lower.includes("sslmode=require");
    const usesPooler = lower.includes(":6543") || lower.includes("pooler");
    sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      ...(needsSsl ? { ssl: "require" as const } : {}),
      ...(usesPooler ? { prepare: false } : {}),
    });
  }
  return sql;
}

/** Ping léger pour healthcheck. */
export async function pingDb(): Promise<boolean> {
  if (!isIntelligenceEnabled()) return false;
  try {
    await getDb()`SELECT 1 AS ok`;
    return true;
  } catch {
    return false;
  }
}
