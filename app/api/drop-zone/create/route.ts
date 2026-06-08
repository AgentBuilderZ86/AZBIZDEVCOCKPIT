import { NextRequest, NextResponse } from "next/server";
import { createContact, createOpportunite, createCompte } from "@/lib/notion";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import type { OppStage } from "@/lib/types";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

interface BatchItem {
  kind: string;
  fields: Record<string, string>;
}

/**
 * POST { compteId?, compteNom?, createCompteNom?, items: BatchItem[] }
 * Crée en lot les objets validés par la Drop Zone.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? (body.items as BatchItem[]) : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Aucun objet à créer." }, { status: 400 });
  }

  let compteId = str(body.compteId);
  let compteNom = str(body.compteNom);

  const created: string[] = [];
  const errors: string[] = [];

  try {
    // Création optionnelle d'un nouveau compte à la volée.
    const newCompteNom = str(body.createCompteNom).trim();
    if (!compteId && newCompteNom) {
      const compte = await createCompte({ compte: newCompteNom });
      compteId = compte.id;
      compteNom = compte.compte;
    }

    const dbReady = isIntelligenceEnabled();
    const db = dbReady ? getDb() : null;

    for (const item of items) {
      const f = item.fields ?? {};
      try {
        if (item.kind === "contact") {
          await createContact(compteId, {
            nomComplet: str(f.nomComplet) || "Contact",
            titre: str(f.titre) || undefined,
            email: str(f.email) || null,
            linkedin: str(f.linkedin) || null,
            telephone: str(f.telephone) || null,
          });
          created.push("contact");
        } else if (item.kind === "opportunite") {
          if (!compteId) throw new Error("Opportunité sans compte");
          const m = parseFloat(str(f.montant));
          await createOpportunite(compteId, {
            opportunite: str(f.opportunite) || "Opportunité",
            montant: Number.isFinite(m) ? m : null,
            stage: (str(f.stage) || null) as OppStage | null,
            nextStep: str(f.nextStep) || undefined,
          });
          created.push("opportunité");
        } else if (item.kind === "tache") {
          if (!db) throw new Error("DB inactive");
          if (!compteId) throw new Error("Tâche sans compte");
          const tacheType = str(f.type) === "appel" ? "appel" : "todo";
          const dueDate = str(f.dueDate) || null;
          await db`
            INSERT INTO taches (compte_id, compte_nom, scope, type, titre, due_date)
            VALUES (${compteId}, ${compteNom}, 'compte', ${tacheType}, ${str(f.titre) || "Tâche"}, ${dueDate})
          `;
          void appendAccountJournal({
            accountUrl: "",
            accountId: compteId,
            eventType: "interaction",
            source: "manuel",
            payload: { kind: "tache_creee", type: tacheType, titre: str(f.titre), via: "drop-zone" },
          }).catch(() => {});
          created.push("tâche");
        } else if (item.kind === "note") {
          if (!db) throw new Error("DB inactive");
          if (!compteId) throw new Error("Note sans compte");
          await appendAccountJournal({
            accountUrl: "",
            accountId: compteId,
            eventType: "note",
            source: "manuel",
            payload: { texte: str(f.texte), via: "drop-zone" },
          });
          created.push("note");
        }
      } catch (e) {
        errors.push(`${item.kind} : ${e instanceof Error ? e.message : "échec"}`);
      }
    }

    return NextResponse.json({ ok: true, created, errors, compteId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de création." },
      { status: 500 }
    );
  }
}
