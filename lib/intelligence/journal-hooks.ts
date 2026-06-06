import "server-only";
import { getCompte } from "../notion";
import type { Compte, CompteUpdate } from "../types";
import type { EnrichmentApply } from "../types";
import {
  appendAccountJournal,
  type JournalEventType,
  type JournalSource,
} from "./journal";
import { alertStageHot } from "./slack-alerts";

export type { JournalSource };
import { isIntelligenceEnabled } from "./config";

async function resolveAccount(accountId: string): Promise<Compte | null> {
  if (!isIntelligenceEnabled()) return null;
  try {
    return await getCompte(accountId);
  } catch {
    return null;
  }
}

/** Journalise les champs compte modifiés via PATCH / cron. */
export async function journalComptePatch(
  compte: Pick<Compte, "id" | "url">,
  patch: CompteUpdate,
  source: JournalSource = "notion_sync"
): Promise<void> {
  /** Le cron utilise journalCronScoreChange (avec from/to). */
  const skipScore = source === "cron";
  if (!isIntelligenceEnabled() || !compte.url) return;

  const entries: Array<{
    eventType: JournalEventType;
    payload: Record<string, unknown>;
  }> = [];

  if (patch.stage !== undefined) {
    entries.push({
      eventType: "stage_change",
      payload: { field: "stage", value: patch.stage },
    });
    if (patch.stage === "Hot" || patch.stage === "Active") {
      void alertStageHot(compte, patch.stage).catch(() => {});
    }
  }
  if (patch.statutRelation !== undefined) {
    entries.push({
      eventType: "stage_change",
      payload: { field: "statutRelation", value: patch.statutRelation },
    });
  }
  if (patch.scoreAdilStar !== undefined && !skipScore) {
    entries.push({
      eventType: "score_change",
      payload: { field: "scoreAdilStar", value: patch.scoreAdilStar },
    });
  }
  if (patch.planStrategique !== undefined) {
    entries.push({
      eventType: "note",
      payload: { field: "planStrategique", length: patch.planStrategique.length },
    });
  }

  for (const e of entries) {
    await appendAccountJournal({
      accountUrl: compte.url,
      accountId: compte.id,
      eventType: e.eventType,
      payload: e.payload,
      source,
    });
  }
}

/** Journalise un enrichissement validé et appliqué. */
export async function journalEnrichmentApplied(
  accountId: string,
  payload: EnrichmentApply,
  result: {
    updatedCompte: boolean;
    contactsCreated: number;
    contactsUpdated: number;
    signauxCreated: number;
  }
): Promise<void> {
  const compte = await resolveAccount(accountId);
  if (!compte?.url) return;

  await appendAccountJournal({
    accountUrl: compte.url,
    accountId: compte.id,
    eventType: "enrichment",
    source: "enrichment",
    payload: {
      compteFields: payload.compteUpdate ?? {},
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      signauxCreated: result.signauxCreated,
      updatedCompte: result.updatedCompte,
    },
  });

  if (result.signauxCreated > 0) {
    await appendAccountJournal({
      accountUrl: compte.url,
      accountId: compte.id,
      eventType: "signal",
      source: "enrichment",
      payload: { count: result.signauxCreated, via: "enrich_apply" },
    });
  }
}

/** Journalise un changement de score détecté par le cron. */
export async function journalCronScoreChange(
  compte: Compte,
  from: number | null,
  to: number
): Promise<void> {
  if (!compte.url) return;
  await appendAccountJournal({
    accountUrl: compte.url,
    accountId: compte.id,
    eventType: "score_change",
    source: "cron",
    payload: { from, to, mode: "heuristic" },
  });
}

/** Saisie manuelle (CR de RDV, note). */
export async function journalManualNote(
  accountId: string,
  payload: Record<string, unknown>,
  actor?: { userId?: string; userEmail?: string }
): Promise<string | null> {
  const compte = await resolveAccount(accountId);
  if (!compte?.url) return null;
  return appendAccountJournal({
    accountUrl: compte.url,
    accountId: compte.id,
    eventType: "interaction",
    source: "manuel",
    payload: { ...payload, ...actor },
  });
}
