import { NextRequest, NextResponse } from "next/server";
import { integrations } from "@/lib/config";
import { classifyDropInput } from "@/lib/intelligence/drop-zone";
import { listComptes } from "@/lib/notion";
import { namesMatch, normalizeName } from "@/lib/enrichment-match";

export const dynamic = "force-dynamic";

/** POST { input } — classe la saisie et propose des comptes existants. */
export async function POST(req: NextRequest) {
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json({ error: "Saisie vide." }, { status: 400 });
  }

  try {
    const classification = await classifyDropInput(input);

    // Match du nom d'entreprise contre les comptes Notion existants.
    let compteCandidates: { id: string; compte: string }[] = [];
    const q = classification.compteQuery?.trim();
    if (q) {
      const comptes = await listComptes().catch(() => []);
      const nq = normalizeName(q);
      compteCandidates = comptes
        .filter((c) => namesMatch(c.compte, q) || normalizeName(c.compte).includes(nq))
        .slice(0, 5)
        .map((c) => ({ id: c.id, compte: c.compte }));
    }

    return NextResponse.json({ classification, compteCandidates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de classification." },
      { status: 500 }
    );
  }
}
