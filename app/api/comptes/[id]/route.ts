import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCompte, updateCompte, archiveCompte } from "@/lib/notion";
import type { CompteUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

// Garde de forme : objet plat (pas de fonctions/structures profondes injectées),
// `_action` limité à "archive". Les champs métier sont validés en aval par Notion.
const PatchSchema = z
  .object({ _action: z.literal("archive").optional() })
  .catchall(z.union([z.string(), z.number(), z.boolean(), z.null()]));

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const compte = await getCompte(params.id);
    return NextResponse.json({ compte });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }
    if (parsed.data._action === "archive") {
      const compte = await archiveCompte(params.id);
      return NextResponse.json({ compte });
    }
    const { _action, ...update } = parsed.data;
    void _action;
    const compte = await updateCompte(params.id, update as CompteUpdate);
    return NextResponse.json({ compte });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  const message =
    err instanceof Error ? err.message : "Erreur inconnue côté serveur.";
  const status = (err as { status?: number })?.status ?? 500;
  // eslint-disable-next-line no-console
  console.error("[api/comptes/:id] error:", message);
  return NextResponse.json({ error: message }, { status });
}
