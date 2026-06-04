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
    sql = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
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
