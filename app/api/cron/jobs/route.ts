import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { claimNextJob, failJob } from "@/lib/intelligence/jobs";
import { runIntelligenceJob } from "@/lib/intelligence/job-runner";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_BATCH = 3;

// Jobs avec recherche web IA (Claude + web_search/web_fetch) : budget worker 45s.
const LONG_JOB_TYPES = new Set([
  "enrich.intel",
  "procurement.research",
  "networking.events",
  "networking.associations",
]);

// Jobs background-only : la recherche web (30-90s) dépasse la limite 26s de cette route.
// Ils sont exécutés DANS leur Background Function dédiée (networking-background.mts) avec
// le budget ~15 min. On les exclut donc ici pour que le worker 24s ne les réserve ni ne
// les tue (sinon le filet horaire scheduled-jobs les ferait échouer à 24s).
const BACKGROUND_ONLY_JOB_TYPES = ["networking.events", "networking.associations"];

/**
 * Traite les jobs intelligence_jobs en attente (ingestion async, etc.).
 * Appeler depuis un cron Netlify ou après scheduled-refresh.
 */
export async function POST(req: NextRequest) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — jobs inactifs." },
      { status: 503 }
    );
  }

  const limit = Math.min(
    10,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? String(DEFAULT_BATCH), 10) || DEFAULT_BATCH)
  );

  const processed: Array<{
    id: string;
    jobType: string;
    status: "done" | "failed";
    error?: string;
  }> = [];

  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob(undefined, BACKGROUND_ONLY_JOB_TYPES);
    if (!job) break;

    // Netlify TUE toute fonction serverless à ~26s (maxDuration ignoré). On borne donc
    // le worker SOUS cette limite : un job web-search trop long échoue PROPREMENT
    // (failJob → statut 'failed' visible) au lieu d'être hard-killé et bloqué en 'processing'.
    const timeoutMs = LONG_JOB_TYPES.has(job.jobType) ? 24_000 : 22_000;
    try {
      await Promise.race([
        runIntelligenceJob(job),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout_worker")), timeoutMs)
        ),
      ]);
      processed.push({ id: job.id, jobType: job.jobType, status: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur job.";
      await failJob(job.id, message);
      processed.push({
        id: job.id,
        jobType: job.jobType,
        status: "failed",
        error: message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    jobs: processed,
    at: new Date().toISOString(),
  });
}

export const GET = POST;
