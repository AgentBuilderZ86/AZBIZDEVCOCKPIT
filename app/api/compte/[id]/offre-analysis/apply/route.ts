import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { updateCompte, createSignal } from "@/lib/notion";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import type { OffreMappingRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const rows = await db<
      {
        compte_url: string;
        mapping_rows: unknown;
        action_steps: unknown;
        synthese_narrative: string;
      }[]
    >`
      SELECT compte_url, mapping_rows, action_steps, synthese_narrative
      FROM compte_offre_analysis
      WHERE compte_id = ${params.id}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json(
        { error: "Aucune analyse disponible pour ce compte. Générez-la d'abord." },
        { status: 404 }
      );
    }

    const row = rows[0];
    const results: { planApplied?: boolean; signauxCreated?: number } = {};

    if (body.applyPlan) {
      const mappingRows = (Array.isArray(row.mapping_rows) ? row.mapping_rows : []) as OffreMappingRow[];
      const actionSteps = Array.isArray(row.action_steps) ? row.action_steps : [];

      const offerLines = mappingRows
        .slice(0, 8)
        .map(
          (m: OffreMappingRow) =>
            `• **${m.topic}** → ${m.siaOffer} _(${m.coverage === "rag_indexed" ? "✅ RAG" : m.coverage === "expertise_sia" ? "🔵 Expertise" : "⚠️ Gap"})_\n  ${m.rationale}`
        )
        .join("\n");

      const actionLines = (actionSteps as Array<{ order: number; horizon: string; action: string; linkedOffer?: string | null }>)
        .slice(0, 6)
        .map(
          (s) =>
            `${s.order}. [${s.horizon}] ${s.action}${s.linkedOffer ? ` _(${s.linkedOffer})_` : ""}`
        )
        .join("\n");

      const newPlan = `## Synthèse Offre Sia\n${row.synthese_narrative}\n\n## Mapping Offres\n${offerLines}\n\n## Plan d'action\n${actionLines}`;

      await updateCompte(params.id, { planStrategique: newPlan });
      results.planApplied = true;
    }

    if (body.applySignaux) {
      const mappingRows = (Array.isArray(row.mapping_rows) ? row.mapping_rows : []) as OffreMappingRow[];
      const relevant = mappingRows.filter(
        (m: OffreMappingRow) => m.coverage !== "gap"
      );

      let created = 0;
      for (const m of relevant.slice(0, 5)) {
        try {
          await createSignal(params.id, {
            titre: `Opportunité Sia : ${m.topic}`,
            typeSignal: "Post compte cible",
            scoreOpportunite: "3 - Moyen",
            notes: `${m.siaOffer} — ${m.rationale}`,
          });
          created++;
        } catch {
          // Signal creation is best-effort
        }
      }
      results.signauxCreated = created;
    }

    void appendAccountJournal({
      accountUrl: row.compte_url,
      accountId: params.id,
      eventType: "enrichment",
      source: "enrichment",
      payload: {
        type: "offre_mapping_applied",
        ...results,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'application.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
