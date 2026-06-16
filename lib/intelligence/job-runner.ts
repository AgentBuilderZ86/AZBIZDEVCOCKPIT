import "server-only";
import { ingestKnowledgeDocument, type IngestInput } from "./knowledge";
import { completeJob, enqueueJob, type IntelligenceJob } from "./jobs";
import { runAccountVeille } from "./veille";
import { buildEnrichmentData, buildEnrichmentIntel, type EnrichmentData } from "@/lib/enrichment";
import { triggerJobWorker } from "./trigger-worker";
import { analyzeCompteOffres } from "./offre-analysis";
import { researchAccountProcurement } from "./procurement";
import { researchEvents, researchAssociations } from "./networking";
import { getDb } from "./db";
import Anthropic from "@anthropic-ai/sdk";

const JOB_KNOWLEDGE_INGEST = "knowledge.ingest";
const JOB_VEILLE_SCAN = "veille.scan";
/** @deprecated — remplacé par enrich.data + enrich.intel */
const JOB_ENRICH_PROPOSAL = "enrich.proposal";
const JOB_ENRICH_DATA = "enrich.data";
const JOB_ENRICH_INTEL = "enrich.intel";
const JOB_OFFRE_ANALYSIS = "offre.analysis";
const JOB_AO_QUALIFY = "ao.qualify";
const JOB_PROCUREMENT_RESEARCH = "procurement.research";
const JOB_NETWORKING_EVENTS = "networking.events";
const JOB_NETWORKING_ASSOCIATIONS = "networking.associations";

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
    case JOB_AO_QUALIFY:
      await runAoQualification(job);
      return;
    case JOB_PROCUREMENT_RESEARCH:
      await runProcurementResearch(job);
      return;
    case JOB_NETWORKING_EVENTS:
      await runNetworkingEvents(job);
      return;
    case JOB_NETWORKING_ASSOCIATIONS:
      await runNetworkingAssociations(job);
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

/** Phase 2 : Claude Sonnet → proposition finale (~8-15s). */
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

async function runAoQualification(job: IntelligenceJob): Promise<void> {
  const batchId = String(job.payload.batchId ?? "").trim();
  if (!batchId) throw new Error("Payload ao.qualify : batchId requis.");

  const db = getDb();
  const rows = await db<{ id: string; titre: string; client: string; description: string; budget_k_eur: number | null; secteur: string }[]>`
    SELECT id, titre, client, description, budget_k_eur, secteur
    FROM ao_submissions
    WHERE batch_id = ${batchId}
    ORDER BY imported_at ASC
  `;

  if (rows.length === 0) {
    await completeJob(job.id, { batchId, qualified: 0 });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await completeJob(job.id, { batchId, qualified: 0, warning: "ANTHROPIC_API_KEY absent" });
    return;
  }

  const client = new Anthropic({ apiKey });

  const aoList = rows.map((r, i) =>
    `[${i}] Titre: "${r.titre}"\n    Client: ${r.client || "N/A"}\n    Secteur: ${r.secteur || "N/A"}\n    Budget: ${r.budget_k_eur ? `${r.budget_k_eur}k€` : "N/A"}\n    Description: ${(r.description || "—").slice(0, 300)}`
  ).join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    tools: [{
      name: "submit_ao_qualifications",
      description: "Soumet les qualifications structurées pour chaque AO analysé.",
      input_schema: {
        type: "object" as const,
        properties: {
          qualifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index:     { type: "number", description: "Index 0-based de l'AO dans la liste" },
                scoreFit:  { type: "number", description: "Score de fit Sia 1-10" },
                synthese:  { type: "string", description: "2-3 phrases : pourquoi cet AO est ou non pertinent pour Sia" },
                suggestion:{ type: "string", enum: ["Go", "NoGo"], description: "Recommandation Go ou NoGo" },
              },
              required: ["index", "scoreFit", "synthese", "suggestion"],
            },
          },
        },
        required: ["qualifications"],
      },
    }],
    tool_choice: { type: "tool", name: "submit_ao_qualifications" },
    system: `Tu es un expert en qualification d'appels d'offres pour Sia Partners, cabinet de conseil spécialisé en : CIO advisory, Digital Banking, Data/IA, Transformation digitale, Excellence opérationnelle, ESG/Durabilité, Risque & Conformité.

Pour chaque AO, évalue la pertinence pour Sia (score 1-10) et fais une recommandation Go/NoGo.
Score 8-10 : AO parfaitement aligné avec l'expertise Sia.
Score 5-7 : AO partiellement aligné, nécessite analyse.
Score 1-4 : AO hors périmètre Sia (secteur public pur, génie civil, IT commodité, etc.).`,
    messages: [{
      role: "user",
      content: `Qualifie ces ${rows.length} appels d'offres :\n\n${aoList}`,
    }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    await completeJob(job.id, { batchId, qualified: 0, warning: "Pas de tool_use dans la réponse Claude" });
    return;
  }

  const qualifications = (toolUse.input as { qualifications: Array<{ index: number; scoreFit: number; synthese: string; suggestion: string }> }).qualifications ?? [];

  let qualified = 0;
  for (const q of qualifications) {
    const row = rows[q.index];
    if (!row) continue;
    await db`
      UPDATE ao_submissions
      SET score_fit = ${q.scoreFit}, synthese = ${q.synthese}, suggestion = ${q.suggestion}, updated_at = now()
      WHERE id = ${row.id}
    `;
    qualified++;
  }

  await completeJob(job.id, { batchId, qualified });
}

async function runProcurementResearch(job: IntelligenceJob): Promise<void> {
  const compteId = String(job.payload.compteId ?? "").trim();
  if (!compteId) throw new Error("Payload procurement.research : compteId requis.");

  const result = await researchAccountProcurement(compteId, job.id);
  await completeJob(job.id, {
    compteId,
    found: Boolean(result.emailAchats || result.fournisseurPortalUrl || result.referencementUrl),
    confidence: result.confidence,
  });
}

async function runNetworkingEvents(job: IntelligenceJob): Promise<void> {
  const sector = (job.payload.sector as string | undefined) ?? null;
  const horizonMonths = Number(job.payload.horizonMonths ?? 12);
  const result = await researchEvents({ sector, horizonMonths }, job.id);
  if (result.error && result.inserted === 0) throw new Error(result.error);
  await completeJob(job.id, { inserted: result.inserted, warning: result.error });
}

async function runNetworkingAssociations(job: IntelligenceJob): Promise<void> {
  const sector = (job.payload.sector as string | undefined) ?? null;
  const result = await researchAssociations({ sector }, job.id);
  if (result.error && result.inserted === 0) throw new Error(result.error);
  await completeJob(job.id, { inserted: result.inserted, warning: result.error });
}

export { JOB_KNOWLEDGE_INGEST, JOB_VEILLE_SCAN, JOB_ENRICH_PROPOSAL, JOB_ENRICH_DATA, JOB_ENRICH_INTEL, JOB_OFFRE_ANALYSIS, JOB_AO_QUALIFY, JOB_PROCUREMENT_RESEARCH, JOB_NETWORKING_EVENTS, JOB_NETWORKING_ASSOCIATIONS };
