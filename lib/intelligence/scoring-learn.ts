import "server-only";
import type { Compte, Signal } from "../types";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";
import { computeHeuristicScore, signalsBonus } from "../scoring";
import {
  fitLogisticRegression,
  scoreWithLogistic,
  encodeFeatures,
  type LogisticModel,
  type TrainingSample,
} from "./logistic-regression";

export interface LearnedWeightsV1 {
  mode: "learned_v1";
  signalsBonusMultiplier: number;
  sampleWon: number;
  sampleLost: number;
}

export interface LearnedWeightsLogistic {
  mode: "logistic_v1";
  model: LogisticModel;
  sampleWon: number;
  sampleLost: number;
}

export type LearnedWeights = LearnedWeightsV1 | LearnedWeightsLogistic;

const DEFAULT_LEARNED: LearnedWeightsV1 = {
  mode: "learned_v1",
  signalsBonusMultiplier: 1,
  sampleWon: 0,
  sampleLost: 0,
};

/** Agrège outcomes × dernier score connu pour calibrer les signaux. */
export async function loadLearnedWeights(): Promise<LearnedWeights> {
  if (!isIntelligenceEnabled()) return DEFAULT_LEARNED;

  const db = getDb();

  // Récupère les features du dernier score connu par compte avec son outcome
  type OutcomeRow = { outcome: string; features: Record<string, unknown>; cnt: string };

  const rows = await db<OutcomeRow[]>`
    WITH latest AS (
      SELECT DISTINCT ON (account_url)
        account_url, features
      FROM score_history
      ORDER BY account_url, scored_at DESC
    ),
    outcome_counts AS (
      SELECT outcome, COUNT(*)::text AS cnt
      FROM outcome_events
      WHERE outcome IN ('won', 'lost')
      GROUP BY outcome
    )
    SELECT
      o.outcome,
      latest.features,
      oc.cnt
    FROM outcome_events o
    INNER JOIN latest ON latest.account_url = o.account_url
    INNER JOIN outcome_counts oc ON oc.outcome = o.outcome
    WHERE o.outcome IN ('won', 'lost')
  `;

  if (rows.length === 0) return DEFAULT_LEARNED;

  const sampleWon = parseInt(rows.find((r: OutcomeRow) => r.outcome === "won")?.cnt ?? "0", 10);
  const sampleLost = parseInt(rows.find((r: OutcomeRow) => r.outcome === "lost")?.cnt ?? "0", 10);

  // Mode logistique si ≥ 50 outcomes (25 won + 25 lost minimum)
  if (sampleWon >= 25 && sampleLost >= 25) {
    const samples: TrainingSample[] = rows.map((r: OutcomeRow) => ({
      features: encodeFeatures(r.features),
      label: r.outcome === "won" ? 1 : 0,
    }));

    const model = fitLogisticRegression(samples);
    return { mode: "logistic_v1", model, sampleWon, sampleLost };
  }

  // Fallback : mode scalar (learned_v1) si ≥ 2 won + 2 lost
  if (sampleWon < 2 || sampleLost < 2) {
    return { ...DEFAULT_LEARNED, sampleWon, sampleLost };
  }

  const wonRows = rows.filter((r: OutcomeRow) => r.outcome === "won");
  const lostRows = rows.filter((r: OutcomeRow) => r.outcome === "lost");
  const avgSig = (arr: OutcomeRow[]) =>
    arr.reduce((s: number, r: OutcomeRow) => s + (parseFloat(String(r.features.signalsBonus ?? 0)) || 0), 0) /
    Math.max(1, arr.length);

  const diff = avgSig(wonRows) - avgSig(lostRows);
  const multiplier = Math.max(0.85, Math.min(1.2, 1 + diff / 30));

  return {
    mode: "learned_v1",
    signalsBonusMultiplier: Math.round(multiplier * 1000) / 1000,
    sampleWon,
    sampleLost,
  };
}

/** Score heuristique + ajustement appris (scalar ou logistique). */
export function computeBlendedScore(
  compte: Compte,
  signaux: Signal[],
  weights: LearnedWeights,
  storedFeatures?: Record<string, unknown>
): { heuristic: number; blended: number; learnedDelta: number } {
  const heuristic = computeHeuristicScore(compte, signaux);

  if (weights.mode === "logistic_v1" && storedFeatures) {
    const mlScore = scoreWithLogistic(weights.model, storedFeatures);
    // Blend 50/50 heuristique + ML pour ne pas trop dériver
    const blended = Math.max(0, Math.min(100, Math.round(0.5 * heuristic + 0.5 * mlScore)));
    return { heuristic, blended, learnedDelta: blended - heuristic };
  }

  // Fallback scalar (learned_v1 ou default)
  const sig = signalsBonus(signaux);
  const multiplier = weights.mode === "learned_v1" ? weights.signalsBonusMultiplier : 1;
  const learnedDelta = Math.round(sig * (multiplier - 1));
  const blended = Math.max(0, Math.min(100, heuristic + learnedDelta));
  return { heuristic, blended, learnedDelta };
}

/** Utilise le blend si assez d'outcomes, sinon heuristique seule. */
export function pickCronScore(
  heuristic: number,
  blended: number,
  weights: LearnedWeights
): number {
  if (weights.mode === "logistic_v1") {
    // Blend 50/50 validé par ≥50 outcomes
    return Math.round(0.5 * heuristic + 0.5 * blended);
  }
  if (weights.sampleWon >= 3 && weights.sampleLost >= 3) {
    return Math.round(0.75 * heuristic + 0.25 * blended);
  }
  return heuristic;
}
