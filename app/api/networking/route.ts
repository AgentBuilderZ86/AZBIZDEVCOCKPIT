import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listEvents, listAssociations } from "@/lib/intelligence/networking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET → événements + associations stockés. */
export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      events: [],
      associations: [],
      message: "DATABASE_URL absente — zone Networking indisponible.",
    });
  }
  try {
    const [events, associations] = await Promise.all([listEvents(), listAssociations()]);
    return NextResponse.json({ enabled: true, events, associations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
