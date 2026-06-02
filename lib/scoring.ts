import type { Compte, Signal } from "./types";

/**
 * Score AdilStar heuristique (0-100), déterministe et SANS appel externe —
 * conçu pour tourner de façon fiable et gratuite sur le cron (Phase 4).
 * Le bouton « Enrichir » (Phase 3) produit un score Claude plus riche ; ce
 * calcul sert de rafraîchissement continu de base.
 */

const STAGE_BASE: Record<string, number> = {
  Cold: 12,
  Warm: 32,
  Hot: 58,
  Active: 72,
  Won: 92,
  Lost: 5,
};

const PRIORITE_BONUS: Record<string, number> = {
  "🔴 Haute": 20,
  "🟡 Moyenne": 10,
  "🟢 Basse": 2,
};

function effectifBonus(effectif: number | null): number {
  if (effectif == null) return 0;
  if (effectif >= 5000) return 15;
  if (effectif >= 1000) return 10;
  if (effectif >= 200) return 5;
  return 2;
}

function arrBonus(arr: number | null): number {
  if (!arr || arr <= 0) return 0;
  // ~ +1 point / 50k€ pondéré, plafonné à +15.
  return Math.min(15, Math.round(arr / 50));
}

function signalScore(s: Signal): number {
  if (!s.scoreOpportunite) return 0;
  const n = parseInt(s.scoreOpportunite, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Bonus signaux ouverts/chauds (jusqu'à +15). */
export function signalsBonus(signaux: Signal[]): number {
  const open = signaux.filter(
    (s) => s.statut === "À exploiter" || s.statut === "En cours"
  );
  const hottest = open.reduce((m, s) => Math.max(m, signalScore(s)), 0);
  return Math.min(15, hottest * 3);
}

export function computeHeuristicScore(
  compte: Compte,
  signaux: Signal[] = []
): number {
  let score = STAGE_BASE[compte.stage ?? "Cold"] ?? 12;
  score += PRIORITE_BONUS[compte.priorite ?? ""] ?? 0;
  score += effectifBonus(compte.effectif);
  score += arrBonus(compte.arrPondere);
  score += signalsBonus(signaux);
  if (compte.statutRelation === "Dormante") score -= 20;
  else if (compte.statutRelation === "Active") score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}
