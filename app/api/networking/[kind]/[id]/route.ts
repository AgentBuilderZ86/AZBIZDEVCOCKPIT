import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { setEventStatus, setAssociationStatus } from "@/lib/intelligence/networking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PATCH { status } → met à jour le statut (saved | dismissed | new) d'un événement ou d'une association. */
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind, id } = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "DATABASE_URL absente." }, { status: 503 });
  }

  let body: { status?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const status = String(body.status ?? "");
  try {
    const ok =
      kind === "events"
        ? await setEventStatus(id, status)
        : kind === "associations"
          ? await setAssociationStatus(id, status)
          : false;
    if (!ok) {
      return NextResponse.json({ error: "Type ou statut invalide." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
