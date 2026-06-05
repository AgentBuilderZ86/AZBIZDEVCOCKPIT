import "server-only";
import { ingestKnowledgeDocument, type IngestInput } from "./knowledge";
import { completeJob, failJob, type IntelligenceJob } from "./jobs";

const JOB_KNOWLEDGE_INGEST = "knowledge.ingest";

/** Traite un job réservé (appelé par /api/cron/jobs). */
export async function runIntelligenceJob(job: IntelligenceJob): Promise<void> {
  switch (job.jobType) {
    case JOB_KNOWLEDGE_INGEST:
      await runKnowledgeIngest(job);
      return;
    default:
      throw new Error(`Type de job inconnu : ${job.jobType}`);
  }
}

async function runKnowledgeIngest(job: IntelligenceJob): Promise<void> {
  const p = job.payload;
  const title = String(p.title ?? "").trim();
  const rawText = String(p.rawText ?? "").trim();
  if (!title || !rawText) {
    throw new Error("Payload knowledge.ingest invalide (title, rawText).");
  }

  const input: IngestInput = {
    title,
    rawText,
    sourceType: (p.sourceType as IngestInput["sourceType"]) ?? "upload",
    sector: (p.sector as IngestInput["sector"]) ?? null,
    accountUrl: (p.accountUrl as string) ?? null,
    outcome: p.outcome === "won" || p.outcome === "lost" ? p.outcome : null,
    metadata: (p.metadata as Record<string, unknown>) ?? {},
  };

  const result = await ingestKnowledgeDocument(input, { skipEmbedBudget: true });
  await completeJob(job.id, { ...result, title: input.title });
}

export { JOB_KNOWLEDGE_INGEST };
