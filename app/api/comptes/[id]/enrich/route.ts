import { NextRequest, NextResponse } from "next/server";
import { buildEnrichmentProposal, applyEnrichment } from "@/lib/enrichment";
import type { EnrichmentApply } from "@/lib/types";

export const dynamic = "force-dynamic";
// L'orchestration (Apollo + Claude) peut prendre du temps.
export const maxDuration = 60;

/** POST → construit la proposition d'enrichissement (aucune écriture). */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const proposal = await buildEnrichmentProposal(params.id);
    return NextResponse.json({ proposal });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PUT → applique le sous-ensemble validé (write-back Notion). */
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
  // eslint-disable-next-line no-console
  console.error("[api/comptes/:id/enrich] error:", message);
  return NextResponse.json({ error: message }, { status });
}
