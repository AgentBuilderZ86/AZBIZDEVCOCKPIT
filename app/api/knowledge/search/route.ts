import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { searchKnowledge } from "@/lib/intelligence/knowledge";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — recherche impossible." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as {
      query?: string;
      sector?: string | null;
      accountUrl?: string | null;
      outcome?: string | null;
      k?: number;
    };

    if (!body.query?.trim()) {
      return NextResponse.json({ error: "query requis." }, { status: 400 });
    }

    const hits = await searchKnowledge(body.query, {
      sector: body.sector,
      accountUrl: body.accountUrl,
      outcome: body.outcome,
      k: body.k ?? 8,
    });

    return NextResponse.json({
      query: body.query,
      hits,
      citations: hits.map((h) => h.citation),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur recherche.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
