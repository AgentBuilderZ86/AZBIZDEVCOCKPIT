import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import type { TacheRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET — liste les tâches, filtrables par compte / cible / statut / fenêtre semaine. */
export async function GET(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const compteId = searchParams.get("compte_id");
  const cibleId = searchParams.get("cible_id");
  const status = searchParams.get("status") ?? "pending";
  const weekOnly = searchParams.get("range") === "week";

  const db = getDb();
  try {
    const rows = await db<TacheRow[]>`
      SELECT id, compte_id, compte_nom, scope, cible_id, cible_nom,
             type, titre, notes, priorite, due_date, status, done_at
      FROM taches
      WHERE status = ${status}
        AND (${compteId}::text IS NULL OR compte_id = ${compteId})
        AND (${cibleId}::text IS NULL OR cible_id = ${cibleId})
        AND (
          ${weekOnly} = false
          OR due_date IS NULL
          OR due_date <= (date_trunc('week', now()) + interval '6 days')::date
        )
      ORDER BY
        (due_date IS NULL),
        due_date ASC,
        CASE priorite WHEN 'haute' THEN 0 WHEN 'moyenne' THEN 1 ELSE 2 END,
        created_at DESC
    `;
    return NextResponse.json({ taches: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}

/** POST — création manuelle d'une tâche / appel. */
export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const compteId = typeof body.compteId === "string" ? body.compteId : "";
  const titre = typeof body.titre === "string" ? body.titre.trim() : "";
  if (!compteId || !titre) {
    return NextResponse.json({ error: "compteId et titre requis." }, { status: 400 });
  }

  const compteNom = typeof body.compteNom === "string" ? body.compteNom : "";
  const scope =
    body.scope === "contact" || body.scope === "opportunite" ? body.scope : "compte";
  const cibleId = typeof body.cibleId === "string" && body.cibleId ? body.cibleId : null;
  const cibleNom = typeof body.cibleNom === "string" ? body.cibleNom : "";
  const type = body.type === "appel" ? "appel" : "todo";
  const notes = typeof body.notes === "string" ? body.notes : "";
  const priorite =
    body.priorite === "haute" || body.priorite === "basse" ? body.priorite : "moyenne";
  const dueDate = typeof body.dueDate === "string" && body.dueDate ? body.dueDate : null;

  const db = getDb();
  try {
    const rows = await db<TacheRow[]>`
      INSERT INTO taches
        (compte_id, compte_nom, scope, cible_id, cible_nom, type, titre, notes, priorite, due_date)
      VALUES
        (${compteId}, ${compteNom}, ${scope}, ${cibleId}, ${cibleNom},
         ${type}, ${titre}, ${notes}, ${priorite}, ${dueDate})
      RETURNING id, compte_id, compte_nom, scope, cible_id, cible_nom,
                type, titre, notes, priorite, due_date, status, done_at
    `;

    void appendAccountJournal({
      accountUrl: "",
      accountId: compteId,
      eventType: "interaction",
      source: "manuel",
      payload: {
        kind: "tache_creee",
        type,
        titre,
        cibleNom: cibleNom || undefined,
        scope,
      },
    }).catch(() => {});

    return NextResponse.json({ tache: rows[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
