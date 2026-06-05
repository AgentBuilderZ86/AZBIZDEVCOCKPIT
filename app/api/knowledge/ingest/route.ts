import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { extractTextFromFile } from "@/lib/intelligence/extract-text";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_KNOWLEDGE_INGEST } from "@/lib/intelligence/job-runner";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import { chunkText } from "@/lib/intelligence/chunking";
import {
  ingestKnowledgeDocument,
  shouldQueueKnowledgeIngest,
  type KnowledgeSourceType,
} from "@/lib/intelligence/knowledge";
import { SECTEURS, type Secteur } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — ingestion impossible." },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const titleField = form.get("title");
    const sourceType = (form.get("sourceType") as KnowledgeSourceType) || "upload";
    const sectorRaw = form.get("sector");
    const outcomeRaw = form.get("outcome");
    const accountUrl = (form.get("accountUrl") as string) || null;

    let rawText = (form.get("text") as string) || "";
    let title = typeof titleField === "string" ? titleField.trim() : "";

    if (file instanceof File && file.size > 0) {
      const maxBytes = 8 * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 8 Mo)." },
          { status: 400 }
        );
      }
      const extracted = await extractTextFromFile(file);
      rawText = extracted.text;
      if (!title) title = extracted.suggestedTitle;
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Fournissez un fichier ou un champ texte." },
        { status: 400 }
      );
    }
    if (!title) title = "Document sans titre";

    let sector: Secteur | null = null;
    if (typeof sectorRaw === "string" && sectorRaw) {
      if (!(SECTEURS as readonly string[]).includes(sectorRaw)) {
        return NextResponse.json({ error: "Secteur invalide." }, { status: 400 });
      }
      sector = sectorRaw as Secteur;
    }

    let outcome: "won" | "lost" | null = null;
    if (outcomeRaw === "won" || outcomeRaw === "lost") outcome = outcomeRaw;

    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Texte trop court ou vide après extraction (PDF scanné ou illisible ?).",
        },
        { status: 400 }
      );
    }

    const ingestPayload = {
      title,
      rawText,
      sourceType,
      sector,
      accountUrl,
      outcome,
      metadata: { ingestedAt: new Date().toISOString() },
    };

    if (shouldQueueKnowledgeIngest(chunks.length)) {
      const jobId = await enqueueJob(JOB_KNOWLEDGE_INGEST, ingestPayload);
      if (!jobId) {
        return NextResponse.json(
          { error: "Impossible d'enfiler le job d'indexation." },
          { status: 500 }
        );
      }
      triggerJobWorker(1);

      return NextResponse.json(
        {
          queued: true,
          jobId,
          title,
          chunkCount: chunks.length,
          message:
            "Document volumineux — indexation en arrière-plan. Surveillez la progression…",
        },
        { status: 202 }
      );
    }

    const result = await ingestKnowledgeDocument(ingestPayload);

    return NextResponse.json({ ok: true, ...result, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur ingestion.";
    const status = clientErrorStatus(message);
    return NextResponse.json({ error: message }, { status });
  }
}

function clientErrorStatus(message: string): number {
  if (
    /trop volumineux|Fournissez|Secteur invalide|Format non supporté|trop court|trop longue|PDF|Supprimez la variable VOYAGE|Document très volumineux|illisible/i.test(
      message
    )
  ) {
    return 400;
  }
  return 500;
}
