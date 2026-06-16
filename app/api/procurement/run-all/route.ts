import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_PROCUREMENT_RESEARCH } from "@/lib/intelligence/job-runner";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import { listComptes } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST → enfile un job procurement.research pour TOUS les comptes (sauf Dormante/Lost).
 * Authentifié par Clerk (middleware). Idempotent par jour : `procurement:{id}:{YYYY-MM-DD}`.
 * Les jobs sont traités en arrière-plan (worker + filet de sécurité horaire scheduled-jobs).
 */
export async function POST() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — couche Intelligence inactive." },
      { status: 503 }
    );
  }
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
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
        JOB_PROCUREMENT_RESEARCH,
        { compteId: c.id },
        `procurement:${c.id}:${day}`
      );
      if (jobId) enqueued++;
      else skipped++;
    }

    if (enqueued > 0) triggerJobWorker(Math.min(enqueued, 5));

    return NextResponse.json({
      ok: true,
      enqueued,
      skipped,
      total: comptes.length,
      message: `${enqueued} compte(s) en file — traitement en arrière-plan.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
