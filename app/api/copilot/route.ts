import { NextRequest, NextResponse } from "next/server";
import { integrations } from "@/lib/config";
import { askPortfolioCopilot } from "@/lib/intelligence/copilot-global";
import { checkRateLimit, clientIp } from "@/lib/rate-limit-upstash";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(`${clientIp(req)}:copilot-global`))) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  let body: { question?: unknown };
  try {
    body = (await req.json()) as { question?: unknown };
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length < 3) {
    return NextResponse.json({ error: "Question trop courte." }, { status: 400 });
  }
  if (question.length > 800) {
    return NextResponse.json({ error: "Question trop longue (max 800 caractères)." }, { status: 400 });
  }

  try {
    const result = await askPortfolioCopilot(question);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur copilote." },
      { status: 500 }
    );
  }
}
