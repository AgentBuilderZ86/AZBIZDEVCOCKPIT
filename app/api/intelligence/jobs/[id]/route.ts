import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getJobById } from "@/lib/intelligence/jobs";

export const dynamic = "force-dynamic";

/** GET — statut d'un job (polling après ingestion async). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence inactive." }, { status: 503 });
  }

  const job = await getJobById(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    jobType: job.jobType,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  });
}
