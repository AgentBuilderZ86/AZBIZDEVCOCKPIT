import { NextRequest, NextResponse } from "next/server";
import {
  fetchNotionPagePlainText,
  parseNotionPageId,
} from "@/lib/notion-content";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { chunkText } from "@/lib/intelligence/chunking";
import { enqueueJob } from "@/lib/intelligence/jobs";
import { JOB_KNOWLEDGE_INGEST } from "@/lib/intelligence/job-runner";
import { triggerJobWorker } from "@/lib/intelligence/trigger-worker";
import {
  ingestKnowledgeDocument,
  shouldQueueKnowledgeIngest,
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
    const body = (await req.json()) as {
      notionUrl?: string;
      title?: string;
      sector?: string;
      outcome?: string;
      accountUrl?: string;
    };

    const pageId = parseNotionPageId(body.notionUrl ?? "");
    if (!pageId) {
      return NextResponse.json(
        { error: "URL ou ID de page Notion invalide." },
        { status: 400 }
      );
    }

    const { title: notionTitle, text: rawText } =
      await fetchNotionPagePlainText(pageId);

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          error:
            "Page Notion vide ou inaccessible (vérifiez le partage avec l'intégration).",
        },
        { status: 400 }
      );
    }

    const title = (body.title?.trim() || notionTitle || "Page Notion").slice(
      0,
      500
    );

    let sector: Secteur | null = null;
    if (body.sector) {
      if (!(SECTEURS as readonly string[]).includes(body.sector)) {
        return NextResponse.json({ error: "Secteur invalide." }, { status: 400 });
      }
      sector = body.sector as Secteur;
    }

    let outcome: "won" | "lost" | null = null;
    if (body.outcome === "won" || body.outcome === "lost") outcome = body.outcome;

    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Contenu trop court après extraction Notion." },
        { status: 400 }
      );
    }

    const ingestPayload = {
      title,
      rawText,
      sourceType: "notion_page" as const,
      sector,
      accountUrl: body.accountUrl?.trim() || null,
      outcome,
      metadata: {
        ingestedAt: new Date().toISOString(),
        notionPageId: pageId,
        notionUrl: body.notionUrl?.trim() ?? null,
      },
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
            "Page Notion volumineuse — indexation en arrière-plan…",
        },
        { status: 202 }
      );
    }

    const result = await ingestKnowledgeDocument(ingestPayload);
    return NextResponse.json({ ok: true, ...result, title });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur ingestion Notion.";
    const status = /invalide|vide|inaccessible|Secteur/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
