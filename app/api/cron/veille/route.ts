import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_VEILLE_SCAN } from "@/lib/intelligence/job-runner";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import { listComptes } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Veille automatique quotidienne — enfile un job veille.scan pour chaque compte
 * actif (non-Dormant, non-Lost). Idempotent par jour grâce à la clé
 * `veille:{id}:{YYYY-MM-DD}`. Déclenché par scheduled-veille.mts à 07:00 UTC.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — veille inactive." },
      { status: 503 }
    );
  }

  try {
    const comptes = await listComptes();
    const day = new Date().toISOString().slice(0, 10);

    let enqueued = 0;
    let skipped = 0;

    for (const c of comptes) {
      if (c.statutRelation === "Dormante") continue;
      if (c.stage === "Lost") continue;

      const jobId = await enqueueJob(
        JOB_VEILLE_SCAN,
        { accountId: c.id },
        `veille:${c.id}:${day}`
      );

      if (jobId) {
        enqueued++;
      } else {
        skipped++;
      }
    }

    if (enqueued > 0) {
      triggerJobWorker(Math.min(enqueued, 5));
    }

    return NextResponse.json({
      ok: true,
      enqueued,
      skipped,
      day,
      at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur cron veille.";
    // eslint-disable-next-line no-console
    console.error("[cron/veille] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = POST;
