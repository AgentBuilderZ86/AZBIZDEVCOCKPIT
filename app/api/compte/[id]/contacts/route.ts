import { NextRequest, NextResponse } from "next/server";
import { listContactsByCompte, createContact } from "@/lib/notion";
import {
  NIVEAUX_INFLUENCE,
  PRIORITES_ENGAGEMENT,
  STATUTS_CONTACT,
} from "@/lib/types";
import type {
  ContactDraft,
  NiveauInfluence,
  PrioriteEngagement,
  StatutContact,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** GET — liste les contacts rattachés au compte (pour le matching de noms). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contacts = await listContactsByCompte(params.id);
    return NextResponse.json({ contacts });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Notion." },
      { status: 500 }
    );
  }
}

/** POST — crée un contact rattaché au compte. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const nomComplet = str(body.nomComplet);
  if (!nomComplet) {
    return NextResponse.json({ error: "nomComplet requis." }, { status: 400 });
  }

  const niveau = str(body.niveauInfluence);
  const priorite = str(body.prioriteEngagement);
  const statut = str(body.statutContact);

  const draft: ContactDraft = {
    nomComplet,
    titre: str(body.titre),
    direction: str(body.direction),
    roleDecisionnel: str(body.roleDecisionnel),
    email: str(body.email) ?? null,
    linkedin: str(body.linkedin) ?? null,
    telephone: str(body.telephone) ?? null,
    niveauInfluence:
      niveau && (NIVEAUX_INFLUENCE as readonly string[]).includes(niveau)
        ? (niveau as NiveauInfluence)
        : null,
    prioriteEngagement:
      priorite && (PRIORITES_ENGAGEMENT as readonly string[]).includes(priorite)
        ? (priorite as PrioriteEngagement)
        : null,
    statutContact:
      statut && (STATUTS_CONTACT as readonly string[]).includes(statut)
        ? (statut as StatutContact)
        : null,
  };

  try {
    const contact = await createContact(params.id, draft);
    return NextResponse.json({ contact });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Notion." },
      { status: 500 }
    );
  }
}
