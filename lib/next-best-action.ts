import type { Compte, Contact, Opportunite, Signal } from "./types";

export interface NextBestAction {
  title: string;
  detail: string;
  urgency: "high" | "medium" | "low";
}

/** Score numérique d'un signal ("5 - Critique" → 5). */
function signalScore(s: Signal): number {
  if (!s.scoreOpportunite) return 0;
  const n = parseInt(s.scoreOpportunite, 10);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Heuristique "Next Best Action" (Phase 2).
 * Priorise : signal chaud à exploiter > next step d'opportunité imminent >
 * absence de décideur identifié > plan stratégique manquant > nurturing.
 * (La Phase 3 remplacera/complétera ceci par un calcul Claude.)
 */
export function computeNextBestAction(
  compte: Compte,
  contacts: Contact[],
  opportunites: Opportunite[],
  signaux: Signal[]
): NextBestAction {
  // 1. Signal ouvert le plus chaud.
  const openSignals = signaux
    .filter((s) => s.statut === "À exploiter")
    .sort((a, b) => signalScore(b) - signalScore(a));
  if (openSignals.length > 0 && signalScore(openSignals[0]) >= 4) {
    const s = openSignals[0];
    return {
      title: `Exploiter le signal « ${s.titre || "sans titre"} »`,
      detail: `Signal ${s.scoreOpportunite ?? ""}${
        s.typeSignal ? ` · ${s.typeSignal}` : ""
      } non encore exploité. Déclencher une prise de contact ciblée.`,
      urgency: "high",
    };
  }

  // 2. Opportunité active avec next step défini.
  const liveOpps = opportunites.filter(
    (o) => o.stage && o.stage !== "Won" && o.stage !== "Lost"
  );
  const withNextStep = liveOpps
    .filter((o) => o.nextStep || o.dateNextStep)
    .sort((a, b) => (a.dateNextStep ?? "9999").localeCompare(b.dateNextStep ?? "9999"));
  if (withNextStep.length > 0) {
    const o = withNextStep[0];
    return {
      title: o.nextStep || `Faire avancer « ${o.opportunite} »`,
      detail: `Opportunité « ${o.opportunite} » (${o.stage})${
        o.dateNextStep ? ` · échéance ${o.dateNextStep}` : ""
      }.`,
      urgency: "high",
    };
  }

  // 3. Aucun décideur identifié.
  const decideurs = contacts.filter(
    (c) => c.niveauInfluence && c.niveauInfluence.startsWith("Décideur")
  );
  if (decideurs.length === 0) {
    return {
      title: "Identifier les décideurs clés",
      detail: contacts.length
        ? "Des contacts existent mais aucun décideur n'est qualifié. Cartographier la décision."
        : "Aucun contact rattaché. Lancer l'enrichissement / la cartographie des parties prenantes.",
      urgency: "medium",
    };
  }

  // 4. Plan stratégique manquant.
  if (!compte.planStrategique || compte.planStrategique.trim().length < 20) {
    return {
      title: "Rédiger le plan stratégique du compte",
      detail:
        "Formaliser enjeux, offres pertinentes et séquence d'approche pour structurer l'attaque.",
      urgency: "medium",
    };
  }

  // 5. Nurturing par défaut.
  return {
    title: "Maintenir l'engagement",
    detail:
      "Pas d'action critique en attente. Entretenir la relation (partage de contenu, point régulier).",
    urgency: "low",
  };
}
