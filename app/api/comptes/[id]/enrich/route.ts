import { NextRequest, NextResponse } from "next/server";
import { buildEnrichmentData, buildEnrichmentIntel, applyEnrichment } from "@/lib/enrichment";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import type { EnrichmentApply } from "@/lib/types";

export const dynamic = "force-dynamic";
// Phase 1 (~8-12s) + Phase 2 Sonnet (~8-15s) = ~16-27s total.
export const maxDuration = 30;

/** POST → collecte sources + analyse Claude, retourne la proposition directement. */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isIntelligenceEnabled()) {
      return NextResponse.json(
        { error: "DATABASE_URL absente — couche Intelligence inactive." },
        { status: 503 }
      );
    }
    if (!integrations.anthropicApiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
    }

    // Phase 1 : Apollo + Hunter + Explorium (~8-12s)
    const data = await buildEnrichmentData(params.id);

    // Phase 2 : Claude Sonnet → proposition finale (~8-15s)
    const proposal = await buildEnrichmentIntel(data);

    return NextResponse.json({ proposal });
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
