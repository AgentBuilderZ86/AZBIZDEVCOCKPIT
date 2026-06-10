import { NextRequest, NextResponse } from "next/server";
import { getCompte } from "@/lib/notion";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listAccountJournal } from "@/lib/intelligence/journal";
import { journalManualNote } from "@/lib/intelligence/journal-hooks";

export const dynamic = "force-dynamic";

/** GET — derniers événements du journal de compte. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      events: [],
      message: "DATABASE_URL absente — journal indisponible.",
    });
  }

  try {
    const compte = await getCompte(params.id);
    const events = await listAccountJournal(compte.url, 50);
    return NextResponse.json({
      enabled: true,
      events: events.map((e) => ({
        ...e,
        eventDate: e.eventDate.toISOString(),
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST — ajoute une entrée manuelle (CR de RDV, note). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      {
        error:
          "Journal indisponible : configurez DATABASE_URL et exécutez npm run db:migrate.",
      },
      { status: 503 }
    );
  }

  try {
    const raw = (await req.json()) as {
      note?: unknown;
      payload?: unknown;
    };
    const note = typeof raw.note === "string" ? raw.note.slice(0, 10000) : "";
    // payload doit être un objet plat sérialisable et de taille raisonnable.
    let payload: Record<string, unknown> = { note };
    if (raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)) {
      const json = JSON.stringify(raw.payload);
      if (json.length > 20000) {
        return NextResponse.json({ error: "Payload trop volumineux." }, { status: 400 });
      }
      payload = raw.payload as Record<string, unknown>;
    }
    const id = await journalManualNote(params.id, payload);
    if (!id) {
      return NextResponse.json(
        { error: "Impossible d'écrire dans le journal." },
        { status: 500 }
      );
    }
    return NextResponse.json({ id });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  const message =
    err instanceof Error ? err.message : "Erreur inconnue côté serveur.";
  return NextResponse.json({ error: message }, { status: 500 });
}
