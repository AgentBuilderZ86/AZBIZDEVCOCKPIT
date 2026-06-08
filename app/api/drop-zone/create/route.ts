import { NextRequest, NextResponse } from "next/server";
import {
  createContact,
  createOpportunite,
  createCompte,
} from "@/lib/notion";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import type { OppStage } from "@/lib/types";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * POST { type, compteId?, compteNom?, createCompteNom?, payload }
 * Crée l'objet détecté par la Drop Zone.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const type = str(body.type);
  const payload = (body.payload ?? {}) as Record<string, unknown>;
  let compteId = str(body.compteId);
  let compteNom = str(body.compteNom);

  try {
    // Création optionnelle d'un nouveau compte à la volée.
    const newCompteNom = str(body.createCompteNom).trim();
    if (!compteId && newCompteNom) {
      const compte = await createCompte({ compte: newCompteNom });
      compteId = compte.id;
      compteNom = compte.compte;
    }

    if (type === "contact") {
      const contact = await createContact(compteId, {
        nomComplet: str(payload.nomComplet) || "Contact",
        prenom: str(payload.prenom) || undefined,
        nom: str(payload.nom) || undefined,
        titre: str(payload.titre) || undefined,
        email: str(payload.email) || null,
        linkedin: str(payload.linkedin) || null,
        telephone: str(payload.telephone) || null,
      });
      return NextResponse.json({ ok: true, kind: "contact", url: contact.url });
    }

    if (type === "opportunite") {
      if (!compteId) {
        return NextResponse.json(
          { error: "Une opportunité doit être rattachée à un compte." },
          { status: 400 }
        );
      }
      const montantRaw = payload.montant;
      const opp = await createOpportunite(compteId, {
        opportunite: str(payload.opportunite) || "Opportunité",
        montant: typeof montantRaw === "number" ? montantRaw : null,
        stage: (str(payload.stage) || null) as OppStage | null,
        nextStep: str(payload.nextStep) || undefined,
      });
      return NextResponse.json({ ok: true, kind: "opportunite", url: opp.url });
    }

    if (type === "tache") {
      if (!isIntelligenceEnabled()) {
        return NextResponse.json({ error: "Intelligence inactive (DATABASE_URL)." }, { status: 503 });
      }
      if (!compteId) {
        return NextResponse.json(
          { error: "Une tâche doit être rattachée à un compte." },
          { status: 400 }
        );
      }
      const db = getDb();
      const tacheType = str(payload.type) === "appel" ? "appel" : "todo";
      const dueDate = str(payload.dueDate) || null;
      await db`
        INSERT INTO taches (compte_id, compte_nom, scope, type, titre, due_date)
        VALUES (${compteId}, ${compteNom}, 'compte', ${tacheType}, ${str(payload.titre) || "Tâche"}, ${dueDate})
      `;
      void appendAccountJournal({
        accountUrl: "",
        accountId: compteId,
        eventType: "interaction",
        source: "manuel",
        payload: { kind: "tache_creee", type: tacheType, titre: str(payload.titre), via: "drop-zone" },
      }).catch(() => {});
      return NextResponse.json({ ok: true, kind: "tache" });
    }

    if (type === "note") {
      if (!isIntelligenceEnabled()) {
        return NextResponse.json({ error: "Intelligence inactive (DATABASE_URL)." }, { status: 503 });
      }
      if (!compteId) {
        return NextResponse.json(
          { error: "Une note doit être rattachée à un compte." },
          { status: 400 }
        );
      }
      await appendAccountJournal({
        accountUrl: "",
        accountId: compteId,
        eventType: "note",
        source: "manuel",
        payload: { texte: str(payload.texte), via: "drop-zone" },
      });
      return NextResponse.json({ ok: true, kind: "note" });
    }

    return NextResponse.json({ error: "Type inconnu." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de création." },
      { status: 500 }
    );
  }
}
