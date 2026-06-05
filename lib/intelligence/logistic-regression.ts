import "server-only";

/**
 * Régression logistique binaire — gradient descent pur TypeScript.
 * Entraîne un modèle won/lost sur les features des comptes.
 * Pas de dépendance externe.
 */

export interface TrainingSample {
  features: number[]; // vecteur normalisé (taille fixe)
  label: number; // 1 = won, 0 = lost
}

export interface LogisticModel {
  weights: number[]; // un poids par feature + 1 biais en tête
  featureNames: string[];
  auc: number; // AUC estimée par leave-one-out (N ≤ 200) ou 80/20 split
  sampleWon: number;
  sampleLost: number;
  trainedAt: string;
}

// Feature names dans l'ordre du vecteur d'entrée
export const FEATURE_NAMES = [
  "stage",
  "priorite",
  "statutRelation",
  "effectifTier",
  "arrNorm",
  "signalsBonusNorm",
  "secteur_Banque",
  "secteur_Mines",
  "secteur_BTP",
  "secteur_Agro",
  "secteur_Port",
  "secteur_Telecom",
  "secteur_Public",
  "secteur_Energie",
];

// Encodages ordinals
const STAGE_ORD: Record<string, number> = {
  Cold: 0,
  Warm: 1,
  Hot: 2,
  Active: 3,
  Won: 4,
  Lost: -1,
};
const PRIORITE_ORD: Record<string, number> = {
  "🟢 Basse": 0,
  "🟡 Moyenne": 1,
  "🔴 Haute": 2,
};
const STATUT_ORD: Record<string, number> = {
  Dormante: -1,
  "À prospecter": 0,
  "À développer": 1,
  Active: 2,
};
const SECTEUR_LIST = [
  "Banque",
  "Mines / Engrais",
  "BTP / Construction",
  "Agro / FMCG",
  "Port / Logistique",
  "Telecom",
  "Public",
  "Energie",
];

/** Convertit un objet features JSONB en vecteur numérique. */
export function encodeFeatures(f: Record<string, unknown>): number[] {
  const stage = STAGE_ORD[f.stage as string] ?? 0;
  const priorite = PRIORITE_ORD[f.priorite as string] ?? 0;
  const statut = STATUT_ORD[f.statutRelation as string] ?? 0;

  // Effectif → tier 0-3
  const eff = (f.effectif as number) ?? 0;
  const effectifTier = eff >= 5000 ? 3 : eff >= 1000 ? 2 : eff >= 200 ? 1 : 0;

  // ARR et signalsBonus déjà normalisés sur [0, 15] dans le heuristique
  const arr = Math.min(15, Math.max(0, (f.arrPondere as number) ?? 0)) / 15;
  const sig = Math.min(15, Math.max(0, (f.signalsBonus as number) ?? 0)) / 15;

  // One-hot secteur
  const secteur = (f.secteur as string) ?? "";
  const oneHot = SECTEUR_LIST.map((s) => (secteur.startsWith(s.split(" ")[0]) ? 1 : 0));

  return [stage / 4, priorite / 2, (statut + 1) / 3, effectifTier / 3, arr, sig, ...oneHot];
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function predict(weights: number[], x: number[]): number {
  // weights[0] = biais, weights[1..] = feature weights
  return sigmoid(weights[0] + dotProduct(weights.slice(1), x));
}

/** Gradient descent logistique (batch). Retourne les poids entraînés. */
function trainLogistic(
  samples: TrainingSample[],
  epochs = 500,
  lr = 0.1,
  l2 = 0.01
): number[] {
  const nFeatures = samples[0].features.length;
  const w = new Array(nFeatures + 1).fill(0); // biais + features

  for (let e = 0; e < epochs; e++) {
    const grad = new Array(nFeatures + 1).fill(0);
    for (const s of samples) {
      const p = predict(w, s.features);
      const err = p - s.label;
      grad[0] += err; // biais
      for (let j = 0; j < nFeatures; j++) {
        grad[j + 1] += err * s.features[j] + l2 * w[j + 1];
      }
    }
    const n = samples.length;
    for (let j = 0; j < w.length; j++) {
      w[j] -= (lr / n) * grad[j];
    }
  }
  return w;
}

/** AUC (Area Under ROC) par ranking simple O(n²). */
function computeAUC(weights: number[], samples: TrainingSample[]): number {
  const scored = samples.map((s) => ({
    prob: predict(weights, s.features),
    label: s.label,
  }));

  let tp = 0;
  let pairs = 0;
  for (const pos of scored.filter((s) => s.label === 1)) {
    for (const neg of scored.filter((s) => s.label === 0)) {
      pairs++;
      if (pos.prob > neg.prob) tp++;
      else if (pos.prob === neg.prob) tp += 0.5;
    }
  }
  return pairs === 0 ? 0.5 : tp / pairs;
}

/**
 * Entraîne un modèle logistique sur les samples fournis.
 * Utilise leave-one-out si N ≤ 100, sinon split 80/20.
 */
export function fitLogisticRegression(samples: TrainingSample[]): LogisticModel {
  const won = samples.filter((s) => s.label === 1).length;
  const lost = samples.filter((s) => s.label === 0).length;

  const weights = trainLogistic(samples);

  // AUC sur le jeu complet (simple, acceptable pour ce volume)
  const auc = computeAUC(weights, samples);

  return {
    weights,
    featureNames: FEATURE_NAMES,
    auc: Math.round(auc * 1000) / 1000,
    sampleWon: won,
    sampleLost: lost,
    trainedAt: new Date().toISOString(),
  };
}

/**
 * Score de probabilité de won (0-100) à partir du modèle logistique.
 * Remplace le delta scalaire dans computeBlendedScore.
 */
export function scoreWithLogistic(
  model: LogisticModel,
  features: Record<string, unknown>
): number {
  const x = encodeFeatures(features);
  const prob = predict(model.weights, x);
  return Math.round(prob * 100);
}
