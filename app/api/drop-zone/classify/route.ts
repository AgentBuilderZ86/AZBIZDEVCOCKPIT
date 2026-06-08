import { NextRequest, NextResponse } from "next/server";
import { integrations } from "@/lib/config";
import { classifyDropInput, type DropItem } from "@/lib/intelligence/drop-zone";
import { listComptes, listContactsByCompte } from "@/lib/notion";
import { namesMatch, normalizeName } from "@/lib/enrichment-match";

export const dynamic = "force-dynamic";

/** Aplati un item Claude en { kind, label, fields } pour édition côté client. */
function flattenItem(item: DropItem): { kind: string; label: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  if (item.kind === "contact" && item.contact) {
    fields.nomComplet = item.contact.nomComplet ?? "";
    fields.titre = item.contact.titre ?? "";
    fields.email = item.contact.email ?? "";
    fields.linkedin = item.contact.linkedin ?? "";
    fields.telephone = item.contact.telephone ?? "";
    fields.managerName = item.contact.managerName ?? "";
  } else if (item.kind === "opportunite" && item.opportunite) {
    fields.opportunite = item.opportunite.opportunite ?? "";
    fields.montant = item.opportunite.montant != null ? String(item.opportunite.montant) : "";
    fields.stage = item.opportunite.stage ?? "";
    fields.nextStep = item.opportunite.nextStep ?? "";
  } else if (item.kind === "tache" && item.tache) {
    fields.titre = item.tache.titre ?? "";
    fields.type = item.tache.type ?? "todo";
    fields.dueDate = item.tache.dueDate ?? "";
  } else if (item.kind === "note" && item.note) {
    fields.texte = item.note.texte ?? "";
  }
  return { kind: item.kind, label: item.label, fields };
}

/** POST { input } — décompose la saisie et propose comptes + détecte les contacts existants. */
export async function POST(req: NextRequest) {
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) return NextResponse.json({ error: "Saisie vide." }, { status: 400 });

  try {
    const plan = await classifyDropInput(input);

    // Match du nom d'entreprise contre les comptes Notion existants.
    let compteCandidates: { id: string; compte: string }[] = [];
    const q = plan.compteQuery?.trim();
    if (q) {
      const comptes = await listComptes().catch(() => []);
      const nq = normalizeName(q);
      compteCandidates = comptes
        .filter((c) => namesMatch(c.compte, q) || normalizeName(c.compte).includes(nq))
        .slice(0, 5)
        .map((c) => ({ id: c.id, compte: c.compte }));
    }

    const items = plan.items.map(flattenItem);

    // Détection de doublons contact contre le compte le plus probable.
    if (compteCandidates.length > 0) {
      const existing = await listContactsByCompte(compteCandidates[0].id).catch(() => []);
      for (const it of items) {
        if (it.kind !== "contact" || !it.fields.nomComplet) continue;
        const match = existing.find((c) => namesMatch(c.nomComplet, it.fields.nomComplet));
        if (match) {
          (it as Record<string, unknown>).existingNom = match.nomComplet;
        }
      }
    }

    return NextResponse.json({
      summary: plan.summary,
      compteQuery: plan.compteQuery,
      compteCandidates,
      items,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur de classification." },
      { status: 500 }
    );
  }
}
