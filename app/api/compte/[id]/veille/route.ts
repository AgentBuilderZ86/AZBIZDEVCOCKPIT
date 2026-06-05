import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_VEILLE_SCAN } from "@/lib/intelligence/job-runner";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import { runAccountVeille } from "@/lib/intelligence/veille";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** POST — veille web sur le compte (sync ou ?async=1). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — veille inactive." },
      { status: 503 }
    );
  }

  const useAsync = req.nextUrl.searchParams.get("async") === "1";

  try {
    if (useAsync) {
      const day = new Date().toISOString().slice(0, 10);
      const jobId = await enqueueJob(
        JOB_VEILLE_SCAN,
        { accountId: params.id },
        `veille:${params.id}:${day}`
      );
      if (!jobId) {
        return NextResponse.json(
          { error: "Veille déjà planifiée aujourd'hui ou file indisponible." },
          { status: 409 }
        );
      }
      triggerJobWorker(1);
      return NextResponse.json({
        queued: true,
        jobId,
        message: "Veille en cours — actualisez le journal dans quelques instants.",
      });
    }

    const result = await runAccountVeille(params.id);
    if (result.error && result.items.length === 0) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      items: result.items,
      journalEntries: result.journalIds.length,
      warning: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur veille.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
