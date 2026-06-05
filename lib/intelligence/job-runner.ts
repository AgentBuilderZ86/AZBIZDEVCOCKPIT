import "server-only";
import { ingestKnowledgeDocument, type IngestInput } from "./knowledge";
import { completeJob, type IntelligenceJob } from "./jobs";
import { runAccountVeille } from "./veille";
import { buildEnrichmentProposal } from "@/lib/enrichment";

const JOB_KNOWLEDGE_INGEST = "knowledge.ingest";
const JOB_VEILLE_SCAN = "veille.scan";
const JOB_ENRICH_PROPOSAL = "enrich.proposal";

/** Traite un job réservé (appelé par /api/cron/jobs). */
export async function runIntelligenceJob(job: IntelligenceJob): Promise<void> {
  switch (job.jobType) {
    case JOB_KNOWLEDGE_INGEST:
      await runKnowledgeIngest(job);
      return;
    case JOB_VEILLE_SCAN:
      await runVeilleScan(job);
      return;
    case JOB_ENRICH_PROPOSAL:
      await runEnrichProposal(job);
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

async function runVeilleScan(job: IntelligenceJob): Promise<void> {
  const accountId = String(job.payload.accountId ?? "");
  if (!accountId) throw new Error("Payload veille.scan : accountId requis.");

  const result = await runAccountVeille(accountId);
  if (result.error && result.items.length === 0) {
    throw new Error(result.error);
  }
  await completeJob(job.id, {
    accountId,
    itemsFound: result.items.length,
    journalIds: result.journalIds,
    warning: result.error,
  });
}

async function runEnrichProposal(job: IntelligenceJob): Promise<void> {
  const compteId = String(job.payload.compteId ?? "").trim();
  if (!compteId) throw new Error("Payload enrich.proposal : compteId requis.");

  const proposal = await buildEnrichmentProposal(compteId);
  // Sérialise la proposition complète dans le résultat du job.
  await completeJob(job.id, { proposal: proposal as unknown as Record<string, unknown> });
}

export { JOB_KNOWLEDGE_INGEST, JOB_VEILLE_SCAN, JOB_ENRICH_PROPOSAL };
