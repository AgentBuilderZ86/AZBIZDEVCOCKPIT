import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { integrations } from "@/lib/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_PROCUREMENT_RESEARCH } from "@/lib/intelligence/job-runner";
import { getAccountProcurement } from "@/lib/intelligence/procurement";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** GET → données Référencement Achats stockées pour ce compte. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ enabled: false, procurement: null });
  }
  try {
    const procurement = await getAccountProcurement(params.id);
    return NextResponse.json({ enabled: true, procurement });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST → lance la recherche web (background job), retourne jobId pour polling. */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — couche Intelligence inactive." },
      { status: 503 }
    );
  }
  if (!integrations.anthropicApiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY absente." }, { status: 503 });
  }

  try {
    const day = new Date().toISOString().slice(0, 10);
    const jobId = await enqueueJob(
      JOB_PROCUREMENT_RESEARCH,
      { compteId: params.id },
      `procurement:${params.id}:${day}`
    );
    if (!jobId) {
      return NextResponse.json(
        { error: "Recherche déjà lancée aujourd'hui ou file indisponible." },
        { status: 409 }
      );
    }

    const base =
      process.env.URL?.trim() ||
      process.env.DEPLOY_PRIME_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "";
    if (base) {
      void fetch(`${base}/api/procurement-bg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      }).catch(() => {});
    }

    return NextResponse.json(
      { queued: true, jobId, message: "Recherche achats en cours (15–35s)." },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur serveur.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
