import "server-only";
import type { Compte, Opportunite, Signal } from "../types";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";
import { signalsBonus } from "../scoring";

/** Features explicables pour le scoring heuristique (Phase 7 — historique). */
export function buildScoreFeatures(
  compte: Compte,
  signaux: Signal[] = []
): Record<string, unknown> {
  return {
    stage: compte.stage,
    priorite: compte.priorite,
    statutRelation: compte.statutRelation,
    effectif: compte.effectif,
    arrPondere: compte.arrPondere,
    signalsBonus: signalsBonus(signaux),
    arrPondereBonus:
      compte.arrPondere && compte.arrPondere > 0
        ? Math.min(15, Math.round(compte.arrPondere / 50))
        : 0,
    signauxCount: signaux.length,
  };
}

const DEFAULT_WEIGHTS: Record<string, unknown> = {
  mode: "heuristic_v1",
  stageBase: 1,
  prioriteBonus: 1,
  effectifBonus: 1,
  arrBonus: 1,
  signalsBonus: 1,
};

/** Enregistre un point dans score_history (append-only). */
export async function recordScoreHistory(
  compte: Pick<Compte, "id" | "url" | "compte">,
  score: number,
  features: Record<string, unknown>,
  weights: Record<string, unknown> = DEFAULT_WEIGHTS
): Promise<void> {
  if (!isIntelligenceEnabled() || !compte.url) return;

  const db = getDb();
  await db`
    INSERT INTO score_history (account_url, account_id, score, features, weights)
    VALUES (
      ${compte.url},
      ${compte.id},
      ${score},
      ${db.json(features as Record<string, never>)},
      ${db.json(weights as Record<string, never>)}
    )
  `;
}

/** Enregistre un outcome Won/Lost (idempotent par opp_url). */
export async function recordOutcomeEvent(
  compte: Pick<Compte, "id" | "url">,
  opp: Pick<Opportunite, "url" | "stage" | "arrPondere">
): Promise<boolean> {
  if (!isIntelligenceEnabled() || !compte.url || !opp.url) return false;
  if (opp.stage !== "Won" && opp.stage !== "Lost") return false;
  const outcome = opp.stage === "Won" ? "won" : "lost";

  const db = getDb();
  const existing = await db<{ id: string }[]>`
    SELECT id FROM outcome_events WHERE opp_url = ${opp.url} LIMIT 1
  `;
  if (existing[0]) return false;

  await db`
    INSERT INTO outcome_events (
      account_url, account_id, opp_url, outcome, amount_keur, closed_at
    ) VALUES (
      ${compte.url},
      ${compte.id},
      ${opp.url},
      ${outcome},
      ${opp.arrPondere ?? null},
      ${new Date()}
    )
  `;
  return true;
}

/** Sync outcomes + historique score lors du cron (Phase 7). */
export async function recordCronScoreSnapshot(
  compte: Compte,
  signaux: Signal[],
  newScore: number
): Promise<void> {
  const features = buildScoreFeatures(compte, signaux);
  await recordScoreHistory(compte, newScore, features);
}
