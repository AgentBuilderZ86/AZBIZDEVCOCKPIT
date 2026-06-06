import { NextRequest, NextResponse } from "next/server";
import { getJobById } from "@/lib/intelligence/jobs";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Couche Intelligence inactive (DATABASE_URL)." },
      { status: 503 }
    );
  }

  try {
    const job = await getJobById(params.jobId);
    if (!job) {
      return NextResponse.json({ error: "Job introuvable." }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
