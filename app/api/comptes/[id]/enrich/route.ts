import { NextRequest, NextResponse } from "next/server";
import { buildEnrichmentData, applyEnrichment } from "@/lib/enrichment";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import { JOB_ENRICH_INTEL } from "@/lib/intelligence/job-runner";
import { checkRateLimit, clientIp } from "@/lib/rate-limit-upstash";
import type { EnrichmentApply } from "@/lib/types";

export const dynamic = "force-dynamic";
// Phase 1 seule tourne ici (~6s). Phase 2 est déléguée à la background function.
export const maxDuration = 30;

/** POST → Phase 1 sync + trigger Phase 2 async, retourne jobId pour polling. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await checkRateLimit(`${clientIp(req)}:enrich`))) {
      return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
    }
    if (!isIntelligenceEnabled()) {
      return NextResponse.json(
        { error: "DATABASE_URL absente — couche Intelligence inactive." },
        { status: 503 }
      );
    }
    if (!integrations.anthropicApiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `enrich.intel:${params.id}:${day}`;

    // Phase 1 : collecte sources externes (~5-8s) — synchrone dans cette route.
    const data = await buildEnrichmentData(params.id);

    // Queue Phase 2 (Claude Sonnet) — traitée par la background function.
    const intelJobId = await enqueueJob(
      JOB_ENRICH_INTEL,
      { data: data as unknown as Record<string, unknown> },
      idempotencyKey
    );

    if (!intelJobId) {
      return NextResponse.json(
        { error: "Enrichissement déjà en cours aujourd'hui. Réessayez dans quelques instants." },
        { status: 409 }
      );
    }

    // Déclenche la Netlify Background Function pour Phase 2.
    // La bg function retourne 202 immédiatement — pas de blocage ici.
    const base =
      process.env.URL?.trim() ||
      process.env.DEPLOY_PRIME_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "";
    if (base) {
      void fetch(`${base}/api/enrich-intel-bg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        queued: true,
        jobId: intelJobId,
        message: "Sources collectées — analyse Claude en cours (15–25s).",
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
