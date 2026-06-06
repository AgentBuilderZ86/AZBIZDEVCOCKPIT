import { NextRequest, NextResponse } from "next/server";
import { askAccountCopilot } from "@/lib/intelligence/copilot";
import {
  isIntelligenceEnabled,
  intelligenceConfig,
} from "@/lib/intelligence/config";
import { pingDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      {
        error:
          "Copilote indisponible : configurez DATABASE_URL et exécutez npm run db:migrate.",
      },
      { status: 503 }
    );
  }

  if (!intelligenceConfig().embeddingsApiKey) {
    return NextResponse.json(
      { error: "EMBEDDINGS_API_KEY absente pour la recherche RAG." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as { question?: string };
    if (!body.question?.trim()) {
      return NextResponse.json({ error: "question requis." }, { status: 400 });
    }

    await pingDb().catch(() => {});
    const result = await askAccountCopilot(params.id, body.question);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur copilote.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
