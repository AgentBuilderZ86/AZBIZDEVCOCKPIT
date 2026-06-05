import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { journalCronScoreChange } from "@/lib/intelligence/journal-hooks";
import {
  recordCronScoreSnapshot,
  recordOutcomeEvent,
} from "@/lib/intelligence/score-history";
import {
  listComptes,
  listOpportunitesByCompte,
  listSignauxByCompte,
  updateCompte,
} from "@/lib/notion";
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
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  try {
    const comptes = await listComptes();
    let updated = 0;
    const changes: Array<{ compte: string; from: number | null; to: number }> = [];

    let outcomesRecorded = 0;

    for (const c of comptes) {
      if (c.statutRelation === "Dormante") continue;
      const signaux = await listSignauxByCompte(c.id);
      const opportunites = await listOpportunitesByCompte(c.id);

      for (const opp of opportunites) {
        const inserted = await recordOutcomeEvent(c, opp).catch(() => false);
        if (inserted) outcomesRecorded++;
      }

      const next = computeHeuristicScore(c, signaux);
      if (next !== c.scoreAdilStar) {
        await updateCompte(
          c.id,
          { scoreAdilStar: next },
          { journalSource: "cron" }
        );
        void journalCronScoreChange(c, c.scoreAdilStar, next).catch(() => {});
        void recordCronScoreSnapshot(c, signaux, next).catch(() => {});
        changes.push({ compte: c.compte, from: c.scoreAdilStar, to: next });
        updated++;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: comptes.length,
      updated,
      outcomesRecorded,
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
