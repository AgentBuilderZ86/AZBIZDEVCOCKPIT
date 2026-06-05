import "server-only";
import type { Compte, Signal } from "../types";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";
import { computeHeuristicScore, signalsBonus } from "../scoring";

export interface LearnedWeights {
  mode: "learned_v1";
  signalsBonusMultiplier: number;
  sampleWon: number;
  sampleLost: number;
}

const DEFAULT_LEARNED: LearnedWeights = {
  mode: "learned_v1",
  signalsBonusMultiplier: 1,
  sampleWon: 0,
  sampleLost: 0,
};

/** Agrège outcomes × dernier score connu pour calibrer les signaux. */
export async function loadLearnedWeights(): Promise<LearnedWeights> {
  if (!isIntelligenceEnabled()) return DEFAULT_LEARNED;

  const db = getDb();
  const rows = await db<
    { outcome: string; avg_signals: string | null; cnt: string }[]
  >`
    WITH latest AS (
      SELECT DISTINCT ON (account_url)
        account_url, features
      FROM score_history
      ORDER BY account_url, scored_at DESC
    )
    SELECT
      o.outcome,
      AVG((latest.features->>'signalsBonus')::numeric)::text AS avg_signals,
      COUNT(*)::text AS cnt
    FROM outcome_events o
    INNER JOIN latest ON latest.account_url = o.account_url
    WHERE o.outcome IN ('won', 'lost')
    GROUP BY o.outcome
  `;

  let wonSignals = 0;
  let lostSignals = 0;
  let sampleWon = 0;
  let sampleLost = 0;

  for (const r of rows) {
    const avg = parseFloat(r.avg_signals ?? "0") || 0;
    const cnt = parseInt(r.cnt, 10) || 0;
    if (r.outcome === "won") {
      wonSignals = avg;
      sampleWon = cnt;
    } else if (r.outcome === "lost") {
      lostSignals = avg;
      sampleLost = cnt;
    }
  }

  if (sampleWon < 2 || sampleLost < 2) {
    return { ...DEFAULT_LEARNED, sampleWon, sampleLost };
  }

  const diff = wonSignals - lostSignals;
  const multiplier = Math.max(0.85, Math.min(1.2, 1 + diff / 30));

  return {
    mode: "learned_v1",
    signalsBonusMultiplier: Math.round(multiplier * 1000) / 1000,
    sampleWon,
    sampleLost,
  };
}

/** Score heuristique + léger ajustement appris sur les signaux. */
export function computeBlendedScore(
  compte: Compte,
  signaux: Signal[],
  weights: LearnedWeights
): { heuristic: number; blended: number; learnedDelta: number } {
  const heuristic = computeHeuristicScore(compte, signaux);
  const sig = signalsBonus(signaux);
  const learnedDelta = Math.round(
    sig * (weights.signalsBonusMultiplier - 1)
  );
  const blended = Math.max(0, Math.min(100, heuristic + learnedDelta));
  return { heuristic, blended, learnedDelta };
}

/** Utilise le blend si assez d'outcomes, sinon heuristique seule. */
export function pickCronScore(
  heuristic: number,
  blended: number,
  weights: LearnedWeights
): number {
  if (weights.sampleWon >= 3 && weights.sampleLost >= 3) {
    return Math.round(0.75 * heuristic + 0.25 * blended);
  }
  return heuristic;
}
