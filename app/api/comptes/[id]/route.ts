import { NextRequest, NextResponse } from "next/server";
import { getCompte, updateCompte, archiveCompte } from "@/lib/notion";
import type { CompteUpdate } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    const body = (await req.json()) as CompteUpdate & { _action?: "archive" };
    if (body._action === "archive") {
      const compte = await archiveCompte(params.id);
      return NextResponse.json({ compte });
    }
    const { _action, ...update } = body;
    void _action;
    const compte = await updateCompte(params.id, update);
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
