import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listEvents, listAssociations } from "@/lib/intelligence/networking";
import { getLatestJob, type IntelligenceJob } from "@/lib/intelligence/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Diagnostic compact du dernier job d'une recherche (pour le bandeau UI). */
function toDiag(job: IntelligenceJob | null) {
  if (!job) return null;
  const inserted = job.result?.inserted;
  const warning = job.result?.warning;
  return {
    status: job.status,
    inserted: typeof inserted === "number" ? inserted : null,
    warning: typeof warning === "string" ? warning : null,
    error: job.error,
    createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : String(job.createdAt ?? ""),
    completedAt:
      job.completedAt instanceof Date ? job.completedAt.toISOString() : null,
  };
}

/** GET → événements + associations stockés + diagnostic des derniers jobs. */
export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      events: [],
      associations: [],
      message: "DATABASE_URL absente — zone Networking indisponible.",
    });
  }
  try {
    const [events, associations, eventJob, assocJob] = await Promise.all([
      listEvents(),
      listAssociations(),
      getLatestJob("networking.events"),
      getLatestJob("networking.associations"),
    ]);
    return NextResponse.json({
      enabled: true,
      events,
      associations,
      diagnostics: { events: toDiag(eventJob), associations: toDiag(assocJob) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
