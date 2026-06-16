import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import {
  JOB_NETWORKING_EVENTS,
  JOB_NETWORKING_ASSOCIATIONS,
} from "@/lib/intelligence/job-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** POST { kind: "events" | "associations", sector? } → lance la recherche web (job). */
export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — couche Intelligence inactive." },
      { status: 503 }
    );
  }
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  let body: { kind?: string; sector?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* corps vide accepté */
  }

  const kind = body.kind === "associations" ? "associations" : body.kind === "events" ? "events" : null;
  if (!kind) {
    return NextResponse.json({ error: "Paramètre 'kind' invalide (events|associations)." }, { status: 400 });
  }

  const sector = body.sector?.trim() || null;
  const jobType = kind === "events" ? JOB_NETWORKING_EVENTS : JOB_NETWORKING_ASSOCIATIONS;

  try {
    const day = new Date().toISOString().slice(0, 10);
    const jobId = await enqueueJob(
      jobType,
      { sector, horizonMonths: 12 },
      `networking.${kind}:${sector ?? "all"}:${day}`
    );
    if (!jobId) {
      return NextResponse.json(
        { error: "Recherche déjà lancée aujourd'hui pour ce filtre." },
        { status: 409 }
      );
    }

    const base =
      process.env.URL?.trim() ||
      process.env.DEPLOY_PRIME_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "";
    if (base) {
      void fetch(`${base}/api/networking-bg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      }).catch(() => {});
    }

    return NextResponse.json(
      { queued: true, jobId, kind, message: "Recherche en cours (20–40s)." },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
