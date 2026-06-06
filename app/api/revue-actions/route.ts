import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { listComptes } from "@/lib/notion";
import type { ActionStep, RevueAction } from "@/lib/types";

export const dynamic = "force-dynamic";

const HORIZON_ORDER: Record<string, number> = { "J+7": 0, "J+30": 1, "J+90": 2, "J+180": 3 };

/** GET — retourne les actions pending triées par urgence */
export async function GET(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status") ?? "pending";

  const db = getDb();
  const rows = await db<RevueAction[]>`
    SELECT id, compte_id, compte_nom, action_text, target_contacts, linked_offer,
           horizon, generated_at, status, done_at, done_type, done_contact, done_notes, updated_at
    FROM revue_actions
    WHERE status = ${statusFilter}
    ORDER BY
      CASE horizon
        WHEN 'J+7'   THEN 0
        WHEN 'J+30'  THEN 1
        WHEN 'J+90'  THEN 2
        WHEN 'J+180' THEN 3
        ELSE 9
      END,
      generated_at ASC
  `;

  return NextResponse.json({ actions: rows });
}

/** POST — synchronise les actionSteps depuis compte_offre_analysis */
export async function POST(_req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  const db = getDb();

  const [analyses, comptes] = await Promise.all([
    db<{ compte_id: string; action_steps: unknown; generated_at: string }[]>`
      SELECT compte_id, action_steps, generated_at
      FROM compte_offre_analysis
      ORDER BY generated_at DESC
    `,
    listComptes().catch(() => [] as Awaited<ReturnType<typeof listComptes>>),
  ]);

  const compteNomById = new Map(comptes.map((c) => [c.id, c.compte]));

  let inserted = 0;
  let skipped = 0;

  for (const row of analyses) {
    const steps = (Array.isArray(row.action_steps) ? row.action_steps : []) as ActionStep[];
    const compteNom = compteNomById.get(row.compte_id) ?? row.compte_id;

    for (const step of steps) {
      if (!step.action) continue;
      const targetContacts = (step.targetContacts ?? []).join(", ");
      try {
        await db`
          INSERT INTO revue_actions
            (compte_id, compte_nom, action_text, target_contacts, linked_offer, horizon, generated_at)
          VALUES
            (${row.compte_id}, ${compteNom}, ${step.action}, ${targetContacts},
             ${step.linkedOffer ?? null}, ${step.horizon}, ${row.generated_at})
          ON CONFLICT (compte_id, action_text) DO NOTHING
        `;
        inserted++;
      } catch {
        skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, inserted, skipped });
}
