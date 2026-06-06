import { NextRequest, NextResponse } from "next/server";
import { analyzeCompteOffres, getCachedAnalysis } from "@/lib/intelligence/offre-analysis";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import { pingDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Couche Intelligence inactive (DATABASE_URL)." },
      { status: 503 }
    );
  }

  try {
    const analysis = await getCachedAnalysis(params.id);
    if (!analysis) {
      return NextResponse.json(
        { error: "Aucune analyse générée pour ce compte." },
        { status: 404 }
      );
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Couche Intelligence inactive (DATABASE_URL)." },
      { status: 503 }
    );
  }
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  // Warm-up connexion DB en parallèle (non-bloquant) : la connexion Neon chauffe
  // pendant les appels Notion, prête quand searchKnowledge/saveAnalysis en ont besoin.
  void pingDb().catch(() => {});

  try {
    const analysis = await analyzeCompteOffres(params.id, { forceRefresh: true });
    return NextResponse.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur génération analyse.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
