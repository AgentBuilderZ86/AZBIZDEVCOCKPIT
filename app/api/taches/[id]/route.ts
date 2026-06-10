import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import { isUuid } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** PATCH — met à jour le statut (ou édite) une tâche. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const db = getDb();
  const id = params.id;
  const status = typeof body.status === "string" ? body.status : null;

  if (!status || !["pending", "in_progress", "done"].includes(status)) {
    return NextResponse.json({ error: "status invalide." }, { status: 400 });
  }

  try {
    if (status === "done") {
      const rows = await db<
        { compte_id: string; type: string; titre: string; cible_nom: string }[]
      >`
        UPDATE taches
        SET status = 'done', done_at = now(), updated_at = now()
        WHERE id = ${id}
        RETURNING compte_id, type, titre, cible_nom
      `;
      const t = rows[0];
      if (t) {
        void appendAccountJournal({
          accountUrl: "",
          accountId: t.compte_id,
          eventType: "action_done",
          source: "manuel",
          payload: {
            kind: "tache",
            type: t.type,
            titre: t.titre,
            cibleNom: t.cible_nom || undefined,
          },
        }).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // pending / in_progress : repasse en non-terminé, efface done_at
    await db`
      UPDATE taches
      SET status = ${status}, done_at = NULL, updated_at = now()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}

/** DELETE — supprime une tâche manuelle. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }
  const db = getDb();
  try {
    await db`DELETE FROM taches WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
