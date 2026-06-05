import { NextRequest, NextResponse } from "next/server";
import { applyEnrichment } from "@/lib/enrichment";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { JOB_ENRICH_DATA } from "@/lib/intelligence/job-runner";
import type { EnrichmentApply } from "@/lib/types";

export const dynamic = "force-dynamic";
// POST est maintenant async — le worker traite le job en arrière-plan.
// PUT (apply) reste synchrone : c'est uniquement des écritures Notion < 5s.
export const maxDuration = 30;

/** POST → enfile un job enrich.proposal et retourne le jobId pour polling. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isIntelligenceEnabled()) {
      return NextResponse.json(
        { error: "DATABASE_URL absente — jobs inactifs." },
        { status: 503 }
      );
    }

    const day = new Date().toISOString().slice(0, 10);
    const jobId = await enqueueJob(
      JOB_ENRICH_DATA,
      { compteId: params.id },
      `enrich.data:${params.id}:${day}`
    );
    if (!jobId) {
      return NextResponse.json(
        { error: "Enrichissement déjà en cours aujourd'hui ou file indisponible." },
        { status: 409 }
      );
    }

    // Déclenche immédiatement le worker (fire-and-forget).
    triggerJobWorker(1);

    return NextResponse.json(
      {
        queued: true,
        jobId,
        message: "Enrichissement en cours (Apollo + Claude) — 60–80s selon les sources.",
      },
      { status: 202 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT → applique le sous-ensemble validé par l'utilisateur (write-back Notion). */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = (await req.json()) as EnrichmentApply;
    const result = await applyEnrichment(params.id, payload);
    return NextResponse.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  const message =
    err instanceof Error ? err.message : "Erreur inconnue côté serveur.";
  const status = (err as { status?: number })?.status ?? 500;
  console.error("[api/comptes/:id/enrich] error:", message);
  return NextResponse.json({ error: message }, { status });
}
