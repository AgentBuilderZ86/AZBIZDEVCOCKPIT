import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { pingDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";

/** GET — vérifie si la couche Intelligence (Postgres) est configurée et joignable. */
export async function GET() {
  const enabled = isIntelligenceEnabled();
  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      ok: false,
      message:
        "DATABASE_URL absente — l'app fonctionne en mode Notion seul (Phases 0–5).",
    });
  }

  const ok = await pingDb();
  return NextResponse.json({
    enabled: true,
    ok,
    message: ok
      ? "Postgres joignable."
      : "DATABASE_URL définie mais connexion échouée — vérifiez les migrations.",
  });
}
