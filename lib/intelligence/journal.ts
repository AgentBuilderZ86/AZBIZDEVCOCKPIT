import "server-only";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";

export const JOURNAL_EVENT_TYPES = [
  "interaction",
  "signal",
  "stage_change",
  "note",
  "opp_update",
  "enrichment",
  "score_change",
  "action_done",
] as const;

export type JournalEventType = (typeof JOURNAL_EVENT_TYPES)[number];

export const JOURNAL_SOURCES = [
  "manuel",
  "apollo",
  "news",
  "notion_sync",
  "cron",
  "enrichment",
] as const;

export type JournalSource = (typeof JOURNAL_SOURCES)[number];

export interface JournalEntryInput {
  accountUrl: string;
  accountId?: string;
  eventType: JournalEventType;
  payload?: Record<string, unknown>;
  source?: JournalSource;
  eventDate?: Date;
}

/** Append-only — ne modifie jamais une entrée existante. */
export async function appendAccountJournal(
  entry: JournalEntryInput
): Promise<string | null> {
  if (!isIntelligenceEnabled()) return null;

  const db = getDb();
  const rows = await db<{ id: string }[]>`
    INSERT INTO account_journal (
      account_url,
      account_id,
      event_type,
      event_date,
      payload,
      source
    ) VALUES (
      ${entry.accountUrl},
      ${entry.accountId ?? null},
      ${entry.eventType},
      ${entry.eventDate ?? new Date()},
      ${db.json((entry.payload ?? {}) as Record<string, never>)},
      ${entry.source ?? "notion_sync"}
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

/** Flux global (tous comptes) — pour le Live Intelligence Feed. */
export async function listPortfolioFeed(opts?: {
  limit?: number;
  sinceDays?: number;
  types?: JournalEventType[];
}): Promise<
  Array<{
    id: string;
    accountId: string | null;
    accountUrl: string;
    eventType: string;
    eventDate: Date;
    payload: Record<string, unknown>;
    source: string;
  }>
> {
  if (!isIntelligenceEnabled()) return [];

  const limit = Math.min(300, Math.max(1, opts?.limit ?? 120));
  const sinceDays = Math.min(365, Math.max(1, opts?.sinceDays ?? 30));
  const types = (opts?.types?.length
    ? opts.types
    : (["signal", "score_change", "stage_change"] as JournalEventType[])) as string[];

  const db = getDb();
  const rows = await db<
    {
      id: string;
      account_url: string;
      account_id: string | null;
      event_type: string;
      event_date: Date;
      payload: Record<string, unknown>;
      source: string;
    }[]
  >`
    SELECT id, account_url, account_id, event_type, event_date, payload, source
    FROM account_journal
    WHERE event_type = ANY(${types})
      AND event_date >= now() - make_interval(days => ${sinceDays})
    ORDER BY event_date DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    accountUrl: r.account_url,
    eventType: r.event_type,
    eventDate: r.event_date,
    payload: r.payload ?? {},
    source: r.source,
  }));
}

export async function listAccountJournal(
  accountUrl: string,
  limit = 50
): Promise<
  Array<{
    id: string;
    eventType: string;
    eventDate: Date;
    payload: Record<string, unknown>;
    source: string;
  }>
> {
  if (!isIntelligenceEnabled()) return [];

  const db = getDb();
  const rows = await db<
    {
      id: string;
      event_type: string;
      event_date: Date;
      payload: Record<string, unknown>;
      source: string;
    }[]
  >`
    SELECT id, event_type, event_date, payload, source
    FROM account_journal
    WHERE account_url = ${accountUrl}
    ORDER BY event_date DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    eventDate: r.event_date,
    payload: r.payload ?? {},
    source: r.source,
  }));
}
