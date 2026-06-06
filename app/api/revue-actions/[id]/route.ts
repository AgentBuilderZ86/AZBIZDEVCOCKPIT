import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import { updateContactDerniereInteraction } from "@/lib/notion";

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

  const db = getDb();
  const id = params.id;
  const status = typeof body.status === "string" ? body.status : null;

  if (!status || !["done", "skipped", "pending"].includes(status)) {
    return NextResponse.json({ error: "status invalide." }, { status: 400 });
  }

  try {
    if (status === "done") {
      const doneType = typeof body.doneType === "string" ? body.doneType : "autre";
      const doneContact = typeof body.doneContact === "string" ? body.doneContact : "";
      const doneNotes = typeof body.doneNotes === "string" ? body.doneNotes : "";

      await db`
        UPDATE revue_actions
        SET status = 'done', done_at = now(), done_type = ${doneType},
            done_contact = ${doneContact}, done_notes = ${doneNotes}, updated_at = now()
        WHERE id = ${id}
      `;

      // Récupère les infos de l'action pour le journal
      const rows = await db<{ compte_id: string; action_text: string; linked_offer: string | null }[]>`
        SELECT compte_id, action_text, linked_offer FROM revue_actions WHERE id = ${id}
      `;
      const action = rows[0];

      if (action) {
        void appendAccountJournal({
          accountUrl: "",
          accountId: action.compte_id,
          eventType: "interaction",
          source: "manuel",
          payload: {
            type: doneType,
            contact: doneContact || undefined,
            notes: doneNotes || undefined,
            linkedOffer: action.linked_offer ?? undefined,
            actionText: action.action_text,
            reviewedVia: "revue_actions",
          },
        }).catch(() => {});

        // Met à jour derniereInteraction du contact Notion (best-effort)
        if (doneContact && action.compte_id) {
          void updateContactDerniereInteraction(action.compte_id, doneContact).catch(() => {});
        }
      }
    } else {
      await db`
        UPDATE revue_actions
        SET status = ${status}, updated_at = now()
        WHERE id = ${id}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur DB." },
      { status: 500 }
    );
  }
}
