import { NextRequest, NextResponse } from "next/server";
import {
  createContact,
  createOpportunite,
  createCompte,
  updateContact,
  listContactsByCompte,
} from "@/lib/notion";
import { namesMatch } from "@/lib/enrichment-match";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { appendAccountJournal } from "@/lib/intelligence/journal";
import { z } from "zod";
import type { OppStage } from "@/lib/types";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const BodySchema = z.object({
  compteId: z.string().max(200).optional(),
  compteNom: z.string().max(300).optional(),
  createCompteNom: z.string().max(300).optional(),
  items: z
    .array(
      z.object({
        kind: z.enum(["contact", "opportunite", "tache", "note"]),
        fields: z.record(z.string(), z.string().max(5000)).default({}),
      })
    )
    .min(1)
    .max(50),
});

type BatchItem = z.infer<typeof BodySchema>["items"][number];

/**
 * POST { compteId?, compteNom?, createCompteNom?, items: BatchItem[] }
 * Crée en lot les objets validés par la Drop Zone.
 */
export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const items: BatchItem[] = parsed.items;

  let compteId = str(parsed.compteId);
  let compteNom = str(parsed.compteNom);

  const created: string[] = [];
  const errors: string[] = [];

  try {
    // Création optionnelle d'un nouveau compte à la volée.
    const newCompteNom = str(parsed.createCompteNom).trim();
    if (!compteId && newCompteNom) {
      const compte = await createCompte({ compte: newCompteNom });
      compteId = compte.id;
      compteNom = compte.compte;
    }

    const dbReady = isIntelligenceEnabled();
    const db = dbReady ? getDb() : null;

    // Carnet nom -> id pour résoudre la hiérarchie (contacts existants + créés).
    const nameToId: { nom: string; id: string }[] = [];
    if (compteId) {
      const existing = await listContactsByCompte(compteId).catch(() => []);
      for (const c of existing) nameToId.push({ nom: c.nomComplet, id: c.id });
    }
    const pendingManagers: { contactId: string; managerName: string }[] = [];

    for (const item of items) {
      const f = item.fields ?? {};
      try {
        if (item.kind === "contact") {
          const contact = await createContact(compteId, {
            nomComplet: str(f.nomComplet) || "Contact",
            titre: str(f.titre) || undefined,
            email: str(f.email) || null,
            linkedin: str(f.linkedin) || null,
            telephone: str(f.telephone) || null,
          });
          nameToId.push({ nom: contact.nomComplet, id: contact.id });
          if (str(f.managerName)) {
            pendingManagers.push({ contactId: contact.id, managerName: str(f.managerName) });
          }
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

    // Résolution de la hiérarchie N+1 (après création de tous les contacts).
    for (const link of pendingManagers) {
      const manager = nameToId.find(
        (n) => n.id !== link.contactId && namesMatch(n.nom, link.managerName)
      );
      if (manager) {
        await updateContact(link.contactId, { managerId: manager.id }).catch(() => {});
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
