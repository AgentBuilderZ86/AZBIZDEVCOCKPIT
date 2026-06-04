import "server-only";
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
    const existing = await db<{ id: string }[]>`
      SELECT id FROM intelligence_jobs
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    if (existing[0]) return existing[0].id;
  }

  const rows = await db<{ id: string }[]>`
    INSERT INTO intelligence_jobs (job_type, idempotency_key, payload)
    VALUES (${jobType}, ${idempotencyKey ?? null}, ${db.json(payload as Record<string, never>)})
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

/** Réserve le prochain job pending (SKIP LOCKED). */
export async function claimNextJob(
  jobTypes?: string[]
): Promise<IntelligenceJob | null> {
  if (!isIntelligenceEnabled()) return null;

  const db = getDb();
  const rows = jobTypes?.length
    ? await db<
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
          WHERE status = 'pending'
            AND job_type IN ${db(jobTypes)}
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING *
      `
    : await db<
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
          WHERE status = 'pending'
          ORDER BY created_at ASC
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
