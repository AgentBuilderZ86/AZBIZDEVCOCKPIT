import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { updateCompte, createSignal } from "@/lib/notion";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import type { OffreMappingRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Couche Intelligence inactive (DATABASE_URL)." },
      { status: 503 }
    );
  }

  let body: { applyPlan?: boolean; applySignaux?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  try {
    const db = getDb();

    const analyses = await db<
      {
        compte_id: string;
        compte_url: string;
        mapping_rows: unknown;
        action_steps: unknown;
        synthese_narrative: string;
      }[]
    >`
      SELECT compte_id, compte_url, mapping_rows, action_steps, synthese_narrative
      FROM compte_offre_analysis
      ORDER BY generated_at DESC
    `;

    if (analyses.length === 0) {
      return NextResponse.json({ ok: true, applied: 0, skipped: 0, total: 0, errors: [] });
    }

    let applied = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of analyses) {
      try {
        if (body.applyPlan) {
          const mappingRows = (Array.isArray(row.mapping_rows) ? row.mapping_rows : []) as OffreMappingRow[];
          const actionSteps = Array.isArray(row.action_steps) ? row.action_steps : [];

          const offerLines = mappingRows
            .slice(0, 8)
            .map(
              (m: OffreMappingRow) =>
                `• **${m.topic}** → ${m.siaOffer} _(${
                  m.coverage === "rag_indexed" ? "✅ RAG" :
                  m.coverage === "expertise_sia" ? "🔵 Expertise" :
                  "⚠️ Gap"
                })_\n  ${m.rationale}`
            )
            .join("\n");

          const actionLines = (
            actionSteps as Array<{ order: number; horizon: string; action: string; linkedOffer?: string | null }>
          )
            .slice(0, 6)
            .map(
              (s) =>
                `${s.order}. [${s.horizon}] ${s.action}${s.linkedOffer ? ` _(${s.linkedOffer})_` : ""}`
            )
            .join("\n");

          const newPlan = `## Synthèse Offre Sia\n${row.synthese_narrative}\n\n## Mapping Offres\n${offerLines}\n\n## Plan d'action\n${actionLines}`;
          await updateCompte(row.compte_id, { planStrategique: newPlan });
        }

        if (body.applySignaux) {
          const mappingRows = (Array.isArray(row.mapping_rows) ? row.mapping_rows : []) as OffreMappingRow[];
          const relevant = mappingRows.filter((m: OffreMappingRow) => m.coverage !== "gap");
          for (const m of relevant.slice(0, 5)) {
            try {
              await createSignal(row.compte_id, {
                titre: `Opportunité Sia : ${m.topic}`,
                typeSignal: "Post compte cible",
                scoreOpportunite: "3 - Moyen",
                notes: `${m.siaOffer} — ${m.rationale}`,
              });
            } catch {
              // best-effort per signal
            }
          }
        }

        void appendAccountJournal({
          accountUrl: row.compte_url,
          accountId: row.compte_id,
          eventType: "enrichment",
          source: "enrichment",
          payload: { type: "offre_mapping_applied", bulk: true },
        }).catch(() => {});

        applied++;
      } catch (err) {
        skipped++;
        errors.push(
          `${row.compte_id}: ${err instanceof Error ? err.message : "Erreur inconnue"}`
        );
      }
    }

    return NextResponse.json({ ok: true, applied, skipped, total: analyses.length, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors du bulk apply.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
