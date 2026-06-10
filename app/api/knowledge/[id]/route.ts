import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { deleteKnowledgeDoc } from "@/lib/intelligence/knowledge";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "DATABASE_URL absente." }, { status: 503 });
  }

  try {
    await deleteKnowledgeDoc(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur suppression.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
