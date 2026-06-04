import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listKnowledgeDocs } from "@/lib/intelligence/knowledge";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      docs: [],
      message: "DATABASE_URL absente — couche RAG indisponible.",
    });
  }

  try {
    const docs = await listKnowledgeDocs();
    return NextResponse.json({ enabled: true, docs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
