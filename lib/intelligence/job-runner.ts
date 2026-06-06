import "server-only";
import { ingestKnowledgeDocument, type IngestInput } from "./knowledge";
import { completeJob, enqueueJob, type IntelligenceJob } from "./jobs";
import { runAccountVeille } from "./veille";
import { buildEnrichmentData, buildEnrichmentIntel, type EnrichmentData } from "@/lib/enrichment";
import { triggerJobWorker } from "./trigger-worker";
import { analyzeCompteOffres } from "./offre-analysis";

const JOB_KNOWLEDGE_INGEST = "knowledge.ingest";
const JOB_VEILLE_SCAN = "veille.scan";
/** @deprecated — remplacé par enrich.data + enrich.intel */
const JOB_ENRICH_PROPOSAL = "enrich.proposal";
const JOB_ENRICH_DATA = "enrich.data";
const JOB_ENRICH_INTEL = "enrich.intel";
const JOB_OFFRE_ANALYSIS = "offre.analysis";

/** Traite un job réservé (appelé par /api/cron/jobs). */
export async function runIntelligenceJob(job: IntelligenceJob): Promise<void> {
  switch (job.jobType) {
    case JOB_KNOWLEDGE_INGEST:
      await runKnowledgeIngest(job);
      return;
    case JOB_VEILLE_SCAN:
      await runVeilleScan(job);
      return;
    case JOB_ENRICH_DATA:
      await runEnrichData(job);
      return;
    case JOB_ENRICH_INTEL:
      await runEnrichIntel(job);
      return;
    case JOB_ENRICH_PROPOSAL:
      // Compatibilité ascendante — exécute les deux phases en séquence.
      await runEnrichDataAndIntel(job);
      return;
    case JOB_OFFRE_ANALYSIS:
      await runOffreAnalysis(job);
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

/** Phase 1 : collecte Apollo + Hunter + web research (~35-50s). */
async function runEnrichData(job: IntelligenceJob): Promise<void> {
  const compteId = String(job.payload.compteId ?? "").trim();
  if (!compteId) throw new Error("Payload enrich.data : compteId requis.");

  const data = await buildEnrichmentData(compteId);

  // Enfile la phase 2 (intel) avec les données comme payload.
  const day = new Date().toISOString().slice(0, 10);
  const intelJobId = await enqueueJob(
    JOB_ENRICH_INTEL,
    { data: data as unknown as Record<string, unknown> },
    `enrich.intel:${compteId}:${day}`
  );

  // Stocke l'ID du job intel dans le résultat pour que l'UI puisse switcher.
  await completeJob(job.id, {
    compteId,
    intelJobId: intelJobId ?? null,
    dataSummary: { sources: data.sources, warnings: data.warnings, peopleCount: data.people.length },
  });

  if (intelJobId) triggerJobWorker(1);
}

/** Phase 2 : Claude Opus → proposition finale (~15-25s). */
async function runEnrichIntel(job: IntelligenceJob): Promise<void> {
  const data = job.payload.data as EnrichmentData | undefined;
  if (!data?.compteId) throw new Error("Payload enrich.intel : data.compteId requis.");

  const proposal = await buildEnrichmentIntel(data);
  await completeJob(job.id, { proposal: proposal as unknown as Record<string, unknown> });
}

/** Compatibilité ascendante : exécute les deux phases dans le même job. */
async function runEnrichDataAndIntel(job: IntelligenceJob): Promise<void> {
  const compteId = String(job.payload.compteId ?? "").trim();
  if (!compteId) throw new Error("Payload enrich.proposal : compteId requis.");

  const data = await buildEnrichmentData(compteId);
  const proposal = await buildEnrichmentIntel(data);
  await completeJob(job.id, { proposal: proposal as unknown as Record<string, unknown> });
}

async function runOffreAnalysis(job: IntelligenceJob): Promise<void> {
  const compteId = String(job.payload.compteId ?? "").trim();
  if (!compteId) throw new Error("Payload offre.analysis : compteId requis.");

  await analyzeCompteOffres(compteId, { forceRefresh: true });
  await completeJob(job.id, { compteId });
}

export { JOB_KNOWLEDGE_INGEST, JOB_VEILLE_SCAN, JOB_ENRICH_PROPOSAL, JOB_ENRICH_DATA, JOB_ENRICH_INTEL, JOB_OFFRE_ANALYSIS };
