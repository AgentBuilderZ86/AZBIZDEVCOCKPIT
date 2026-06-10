import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_VEILLE_SCAN } from "@/lib/intelligence/job-runner";
import { listComptes } from "@/lib/notion";

export const dynamic = "force-dynamic";

/** POST — enqueue une veille pour les comptes Hot/Active (idempotent par jour). */
export async function POST() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive (DATABASE_URL)." }, { status: 503 });
  }
  try {
    const comptes = await listComptes();
    const targets = comptes.filter((c) => c.stage === "Hot" || c.stage === "Active").slice(0, 15);
    const day = new Date().toISOString().slice(0, 10);
    let queued = 0;
    for (const c of targets) {
      const id = await enqueueJob(
        JOB_VEILLE_SCAN,
        { accountId: c.id },
        `veille:${c.id}:${day}`
      );
      if (id) queued++;
    }
    return NextResponse.json({ ok: true, queued, targets: targets.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur scan." },
      { status: 500 }
    );
  }
}
