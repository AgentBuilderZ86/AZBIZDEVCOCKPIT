import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { AO_STATUTS, type AoStatut } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const id = params.id;
  const db = getDb();

  try {
    if ("statut" in body) {
      const statut = body.statut as string;
      if (!AO_STATUTS.includes(statut as AoStatut)) {
        return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
      }
      await db`UPDATE ao_submissions SET statut = ${statut}, updated_at = now() WHERE id = ${id}`;
    }

    if ("notes" in body) {
      const notes = String(body.notes ?? "");
      await db`UPDATE ao_submissions SET notes = ${notes}, updated_at = now() WHERE id = ${id}`;
    }

    if ("compteNotionId" in body) {
      const compteNotionId = String(body.compteNotionId ?? "");
      const compteNom = String(body.compteNom ?? "");
      await db`UPDATE ao_submissions SET compte_notion_id = ${compteNotionId}, compte_nom = ${compteNom}, updated_at = now() WHERE id = ${id}`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
