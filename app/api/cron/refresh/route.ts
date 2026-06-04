import { NextRequest, NextResponse } from "next/server";
import { listComptes, listSignauxByCompte, updateCompte } from "@/lib/notion";
import { computeHeuristicScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Rafraîchissement périodique (Phase 4) — recalcule le Score AdilStar
 * heuristique de chaque compte non dormant et écrit dans Notion si changement.
 * Déclenché par la Netlify Scheduled Function (netlify/functions/scheduled-refresh).
 * Protégé par CRON_SECRET.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const provided =
      auth?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("key");
    if (provided !== secret) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }
  }

  try {
    const comptes = await listComptes();
    let updated = 0;
    const changes: Array<{ compte: string; from: number | null; to: number }> = [];

    for (const c of comptes) {
      if (c.statutRelation === "Dormante") continue;
      const signaux = await listSignauxByCompte(c.id);
      const next = computeHeuristicScore(c, signaux);
      if (next !== c.scoreAdilStar) {
        await updateCompte(c.id, { scoreAdilStar: next });
        changes.push({ compte: c.compte, from: c.scoreAdilStar, to: next });
        updated++;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: comptes.length,
      updated,
      changes,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur cron.";
    // eslint-disable-next-line no-console
    console.error("[cron/refresh] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Permet un déclenchement manuel de test (GET) avec le même contrôle de secret.
export const GET = POST;
