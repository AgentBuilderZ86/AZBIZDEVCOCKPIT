import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import type { Ao, AoStatut } from "@/lib/types";

export const dynamic = "force-dynamic";

function rowToAo(r: Record<string, unknown>): Ao {
  return {
    id: String(r.id ?? ""),
    batchId: String(r.batch_id ?? ""),
    titre: String(r.titre ?? ""),
    client: String(r.client ?? ""),
    datePublication: r.date_publication ? String(r.date_publication).slice(0, 10) : null,
    deadline: r.deadline ? String(r.deadline).slice(0, 10) : null,
    budgetKEur: r.budget_k_eur != null ? Number(r.budget_k_eur) : null,
    description: String(r.description ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    secteur: String(r.secteur ?? ""),
    scoreFit: r.score_fit != null ? Number(r.score_fit) : null,
    synthese: String(r.synthese ?? ""),
    suggestion: String(r.suggestion ?? ""),
    statut: (r.statut as AoStatut) ?? "BO",
    compteNotionId: String(r.compte_notion_id ?? ""),
    compteNom: String(r.compte_nom ?? ""),
    notes: String(r.notes ?? ""),
    importedAt: String(r.imported_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export async function GET(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  const statut = req.nextUrl.searchParams.get("statut");

  try {
    const db = getDb();
    const rows = statut
      ? await db<Record<string, unknown>[]>`
          SELECT * FROM ao_submissions
          WHERE statut = ${statut}
          ORDER BY deadline ASC NULLS LAST, imported_at DESC
        `
      : await db<Record<string, unknown>[]>`
          SELECT * FROM ao_submissions
          ORDER BY deadline ASC NULLS LAST, imported_at DESC
        `;

    return NextResponse.json({ aos: rows.map(rowToAo) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
