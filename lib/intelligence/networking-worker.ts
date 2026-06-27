// Pas de `import "server-only"` : ce module est bundlé dans networking-background.mts
// (Netlify Background Function) où `server-only` planterait au build (throw hors react-server).
import { claimNextJob, completeJob, failJob, type IntelligenceJob } from "./jobs";
import { researchEvents, researchAssociations } from "./networking";

/**
 * Worker DÉDIÉ aux jobs networking, conçu pour tourner DANS une Netlify Background
 * Function (budget ~15 min) et NON dans /api/cron/jobs (route Next.js plafonnée à 26 s).
 *
 * La recherche web (Claude + web_search/web_fetch, jusqu'à 5 tours) prend 30-90 s :
 * elle ne peut donc PAS s'exécuter sous la limite 26 s de Netlify. C'est l'unique
 * raison d'être de ce module, importé uniquement par networking-background.mts.
 *
 * Imports volontairement minimaux (jobs + networking → db/config + SDK Anthropic +
 * postgres) : aucun alias `@/` ni `import "server-only"` côté navigateur, pour rester
 * bundle-safe avec esbuild/zisi (cf. CLAUDE.md règle 5).
 */

export const NETWORKING_JOB_TYPES = ["networking.events", "networking.associations"];

async function runOne(
  job: IntelligenceJob
): Promise<{ inserted: number; warning: string | null }> {
  const sector = (job.payload.sector as string | undefined) ?? null;

  if (job.jobType === "networking.associations") {
    const result = await researchAssociations({ sector }, job.id);
    if (result.error && result.inserted === 0) throw new Error(result.error);
    return { inserted: result.inserted, warning: result.error };
  }

  // networking.events (défaut)
  const horizonMonths = Number(job.payload.horizonMonths ?? 12);
  const result = await researchEvents({ sector, horizonMonths }, job.id);
  if (result.error && result.inserted === 0) throw new Error(result.error);
  return { inserted: result.inserted, warning: result.error };
}

// Garde-fou dur : une Background Function Netlify est tuée à 15 min. Si un job dépasse
// ce délai, on le marque 'failed' (au lieu de le laisser coincé en 'processing' et
// re-déclenché en boucle par le cron horaire — ce qui brûle des crédits API).
const JOB_HARD_TIMEOUT_MS = 10 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Délai d'exécution dépassé (garde-fou worker).")), ms)
    ),
  ]);
}

export interface NetworkingRunSummary {
  processed: number;
  jobs: Array<{
    id: string;
    jobType: string;
    status: "done" | "failed";
    inserted?: number;
    error?: string;
  }>;
}

/**
 * Réserve et exécute jusqu'à `max` jobs networking en attente, avec le budget complet
 * de la Background Function. Chaque job complété (`completeJob`) ou échoué (`failJob`)
 * devient terminal → le polling client détecte `done`/`failed`.
 */
export async function runNetworkingJobs(max = 2): Promise<NetworkingRunSummary> {
  const jobs: NetworkingRunSummary["jobs"] = [];

  for (let i = 0; i < max; i++) {
    const job = await claimNextJob(NETWORKING_JOB_TYPES);
    if (!job) break;

    try {
      const { inserted, warning } = await withTimeout(runOne(job), JOB_HARD_TIMEOUT_MS);
      await completeJob(job.id, { inserted, warning });
      jobs.push({ id: job.id, jobType: job.jobType, status: "done", inserted });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur job networking.";
      await failJob(job.id, message);
      jobs.push({ id: job.id, jobType: job.jobType, status: "failed", error: message });
    }
  }

  return { processed: jobs.length, jobs };
}
