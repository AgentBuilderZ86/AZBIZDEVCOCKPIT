import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";

export const dynamic = "force-dynamic";

/** PATCH — met à jour le statut (ou édite) une tâche. */
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

  const db = getDb();
  const id = params.id;
  const status = typeof body.status === "string" ? body.status : null;

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

    if (status === "pending") {
      await db`
        UPDATE taches
        SET status = 'pending', done_at = NULL, updated_at = now()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "status invalide." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}

/** DELETE — supprime une tâche manuelle. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
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
