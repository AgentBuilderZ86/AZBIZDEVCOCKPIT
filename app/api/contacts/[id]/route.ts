import { NextRequest, NextResponse } from "next/server";
import { updateContact } from "@/lib/notion";
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
  return typeof v === "string" ? v : undefined;
}
function strOrNull(v: unknown): string | null | undefined {
  if (v === null) return null;
  return typeof v === "string" ? v : undefined;
}

/** PATCH — met à jour les champs d'un contact existant dans Notion. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const patch: Partial<ContactDraft> = {};
  if (body.titre !== undefined) patch.titre = str(body.titre);
  if (body.direction !== undefined) patch.direction = str(body.direction);
  if (body.roleDecisionnel !== undefined) patch.roleDecisionnel = str(body.roleDecisionnel);
  if (body.email !== undefined) patch.email = strOrNull(body.email);
  if (body.linkedin !== undefined) patch.linkedin = strOrNull(body.linkedin);
  if (body.telephone !== undefined) patch.telephone = strOrNull(body.telephone);
  if (body.niveauInfluence !== undefined) {
    const v = str(body.niveauInfluence);
    patch.niveauInfluence =
      v && (NIVEAUX_INFLUENCE as readonly string[]).includes(v)
        ? (v as NiveauInfluence)
        : null;
  }
  if (body.prioriteEngagement !== undefined) {
    const v = str(body.prioriteEngagement);
    patch.prioriteEngagement =
      v && (PRIORITES_ENGAGEMENT as readonly string[]).includes(v)
        ? (v as PrioriteEngagement)
        : null;
  }
  if (body.statutContact !== undefined) {
    const v = str(body.statutContact);
    patch.statutContact =
      v && (STATUTS_CONTACT as readonly string[]).includes(v)
        ? (v as StatutContact)
        : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  try {
    const contact = await updateContact(params.id, patch);
    return NextResponse.json({ contact });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Notion." },
      { status: 500 }
    );
  }
}
