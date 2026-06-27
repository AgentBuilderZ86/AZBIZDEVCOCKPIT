// Pas de `import "server-only"` : ce module est bundlé dans une Netlify Background Function
// (networking-worker.ts) où `server-only` planterait au build (throw hors react-server).
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface IntelligenceJob {
  id: string;
  jobType: string;
  idempotencyKey: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

function mapJob(row: {
  id: string;
  job_type: string;
  idempotency_key: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}): IntelligenceJob {
  return {
    id: row.id,
    jobType: row.job_type,
    idempotencyKey: row.idempotency_key,
    payload: row.payload ?? {},
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/** Enfile un job (idempotent si clé fournie). */
export async function enqueueJob(
  jobType: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): Promise<string | null> {
  if (!isIntelligenceEnabled()) return null;

  const db = getDb();
  if (idempotencyKey) {
    // On NE déduplique PAS contre un job 'failed' : un échec (clé API, timeout, etc.)
    // doit pouvoir être relancé le même jour avec la même clé. Sinon la clé d'idempotence
    // (ex. networking.events:all:JJ) verrouillerait l'utilisateur sur l'ancien job échoué.
    const existing = await db<{ id: string }[]>`
      SELECT id FROM intelligence_jobs
      WHERE idempotency_key = ${idempotencyKey}
        AND status <> 'failed'
      LIMIT 1
    `;
    if (existing[0]) return existing[0].id;
  }

  // La colonne idempotency_key porte une contrainte UNIQUE : un nouvel INSERT avec la
  // clé d'un job 'failed' existant violerait la contrainte. On fait donc un upsert qui
  // RECYCLE la ligne échouée (repasse en 'pending', réinitialise erreur/résultat/dates).
  // Le SELECT ci-dessus a déjà court-circuité les jobs non-'failed' (pending/processing/done),
  // donc le WHERE du DO UPDATE garantit qu'on ne réveille jamais un job déjà actif/terminé.
  const rows = await db<{ id: string }[]>`
    INSERT INTO intelligence_jobs (job_type, idempotency_key, payload)
    VALUES (${jobType}, ${idempotencyKey ?? null}, ${db.json(payload as Record<string, never>)})
    ON CONFLICT (idempotency_key) DO UPDATE
      SET status = 'pending',
          payload = EXCLUDED.payload,
          error = NULL,
          result = NULL,
          started_at = NULL,
          completed_at = NULL,
          created_at = now()
      WHERE intelligence_jobs.status = 'failed'
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

/**
 * Réserve le prochain job pending (SKIP LOCKED).
 * - `jobTypes` : ne réserve QUE ces types (liste blanche).
 * - `excludeJobTypes` : ne réserve JAMAIS ces types (liste noire), utile pour exclure
 *   les jobs background-only (ex. networking.*) du worker /api/cron/jobs plafonné à 26 s.
 * `jobTypes` a priorité si les deux sont fournis.
 */
export async function claimNextJob(
  jobTypes?: string[],
  excludeJobTypes?: string[]
): Promise<IntelligenceJob | null> {
  if (!isIntelligenceEnabled()) return null;

  const db = getDb();
  const typeFilter = jobTypes?.length
    ? db`AND job_type IN ${db(jobTypes)}`
    : excludeJobTypes?.length
      ? db`AND job_type NOT IN ${db(excludeJobTypes)}`
      : db``;

  const rows = await db<
    {
      id: string;
      job_type: string;
      idempotency_key: string | null;
      payload: Record<string, unknown>;
      status: JobStatus;
      result: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
    }[]
  >`
    UPDATE intelligence_jobs
    SET status = 'processing', started_at = now()
    WHERE id = (
      SELECT id FROM intelligence_jobs
      WHERE (status = 'pending'
             OR (status = 'processing' AND started_at < now() - interval '3 minutes'))
        ${typeFilter}
      ORDER BY (status = 'pending') DESC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;

  const row = rows[0];
  return row ? mapJob(row) : null;
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  if (!isIntelligenceEnabled()) return;
  const db = getDb();
  await db`
    UPDATE intelligence_jobs
    SET status = 'done', result = ${db.json(result as Record<string, never>)}, completed_at = now()
    WHERE id = ${jobId}::uuid
  `;
}

export async function failJob(jobId: string, error: string): Promise<void> {
  if (!isIntelligenceEnabled()) return;
  const db = getDb();
  await db`
    UPDATE intelligence_jobs
    SET status = 'failed', error = ${error}, completed_at = now()
    WHERE id = ${jobId}::uuid
  `;
}

/** Dernier job d'un type donné (pour diagnostic UI). */
export async function getLatestJob(jobType: string): Promise<IntelligenceJob | null> {
  if (!isIntelligenceEnabled()) return null;
  const db = getDb();
  const rows = await db<
    {
      id: string;
      job_type: string;
      idempotency_key: string | null;
      payload: Record<string, unknown>;
      status: JobStatus;
      result: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
    }[]
  >`
    SELECT * FROM intelligence_jobs
    WHERE job_type = ${jobType}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapJob(row) : null;
}

/** Statut d'un job pour polling client. */
export async function getJobById(jobId: string): Promise<IntelligenceJob | null> {
  if (!isIntelligenceEnabled()) return null;
  const db = getDb();
  const rows = await db<
    {
      id: string;
      job_type: string;
      idempotency_key: string | null;
      payload: Record<string, unknown>;
      status: JobStatus;
      result: Record<string, unknown> | null;
      error: string | null;
      created_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
    }[]
  >`
    SELECT * FROM intelligence_jobs WHERE id = ${jobId}::uuid LIMIT 1
  `;
  const row = rows[0];
  return row ? mapJob(row) : null;
}
