import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { AO_STATUTS, type AoStatut } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

      // BO_GO → génère automatiquement une revue_action J+7 si l'AO est lié à un compte
      if (statut === "BO_GO") {
        const aoRows = await db<{ titre: string; client: string; compte_notion_id: string; compte_nom: string }[]>`
          SELECT titre, client, compte_notion_id, compte_nom FROM ao_submissions WHERE id = ${id}
        `;
        const ao = aoRows[0];
        if (ao?.compte_notion_id) {
          const actionText = `Préparer la réponse AO : ${ao.titre} (${ao.client})`;
          await db`
            INSERT INTO revue_actions (compte_id, compte_nom, action_text, horizon, target_contacts)
            VALUES (${ao.compte_notion_id}, ${ao.compte_nom}, ${actionText}, 'J+7', '')
            ON CONFLICT (compte_id, action_text) DO NOTHING
          `;
        }
      }

      // PW/PL → alimente outcome_events pour le scoring
      if (statut === "PW" || statut === "PL") {
        const aoRows = await db<{ budget_k_eur: number | null; compte_notion_id: string }[]>`
          SELECT budget_k_eur, compte_notion_id FROM ao_submissions WHERE id = ${id}
        `;
        const ao = aoRows[0];
        if (ao) {
          await db`
            INSERT INTO outcome_events (account_url, account_id, opp_url, outcome, amount_keur)
            VALUES ('', ${ao.compte_notion_id ?? ''}, '', ${statut === "PW" ? "won" : "lost"}, ${ao.budget_k_eur ?? null})
          `.catch(() => {});
        }
      }
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
