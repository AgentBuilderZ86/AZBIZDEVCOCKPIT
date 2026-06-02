import {
  PRIORITES,
  SECTEURS,
  STAGES,
  STATUTS_RELATION,
  type Compte,
} from "./types";

/** Métadonnée des champs select (réutilisée par filtres + édition inline). */
export const SELECT_FIELDS = {
  secteur: { label: "Secteur", options: SECTEURS },
  priorite: { label: "Priorité", options: PRIORITES },
  stage: { label: "Stage", options: STAGES },
  statutRelation: { label: "Statut relation", options: STATUTS_RELATION },
} as const;

/** Map global valeur → classes Tailwind (partagé comptes + entités liées). */
const VALUE_COLORS: Record<string, string> = {
  // Priorité compte
  "🔴 Haute": "bg-red-100 text-red-800",
  "🟡 Moyenne": "bg-yellow-100 text-yellow-800",
  "🟢 Basse": "bg-green-100 text-green-800",
  // Stage compte
  Cold: "bg-slate-100 text-slate-700",
  Warm: "bg-orange-100 text-orange-800",
  Hot: "bg-red-100 text-red-800",
  Active: "bg-blue-100 text-blue-800",
  Won: "bg-green-100 text-green-800",
  Lost: "bg-stone-200 text-stone-700",
  // Statut relation
  "À développer": "bg-orange-100 text-orange-800",
  "À prospecter": "bg-sky-100 text-sky-800",
  Dormante: "bg-gray-200 text-gray-600",
  // Priorité engagement contact
  "🔴 P1": "bg-red-100 text-red-800",
  "🟡 P2": "bg-yellow-100 text-yellow-800",
  "🟢 P3": "bg-green-100 text-green-800",
  // Statut contact
  Identifié: "bg-blue-100 text-blue-800",
  "À identifier": "bg-gray-100 text-gray-700",
  Contacté: "bg-orange-100 text-orange-800",
  Engagé: "bg-green-100 text-green-800",
  Inactif: "bg-stone-200 text-stone-700",
  // Opp stages
  Discovery: "bg-slate-100 text-slate-700",
  Qualified: "bg-blue-100 text-blue-800",
  Proposal: "bg-purple-100 text-purple-800",
  Negotiation: "bg-orange-100 text-orange-800",
  // Score signal
  "5 - Critique": "bg-red-100 text-red-800",
  "4 - Élevé": "bg-orange-100 text-orange-800",
  "3 - Moyen": "bg-yellow-100 text-yellow-800",
  "2 - Faible": "bg-blue-100 text-blue-800",
  "1 - À surveiller": "bg-gray-100 text-gray-600",
  // Statut signal
  "À exploiter": "bg-orange-100 text-orange-800",
  "En cours": "bg-blue-100 text-blue-800",
  Exploité: "bg-green-100 text-green-800",
  Archivé: "bg-gray-200 text-gray-600",
};

/** Couleur de badge selon une valeur (string libre). */
export function valueBadgeClass(value: string | null | undefined): string {
  if (!value) return "bg-muted text-muted-foreground";
  return VALUE_COLORS[value] ?? "bg-indigo-100 text-indigo-800";
}

/** Couleur de badge pour un champ select de compte. */
export function badgeClass(
  _field: keyof typeof SELECT_FIELDS,
  value: string | null
): string {
  return valueBadgeClass(value);
}

/** Comparateur de tri pour une colonne donnée. */
export type SortKey = keyof Compte;

export function sortComptes(
  comptes: Compte[],
  key: SortKey,
  dir: "asc" | "desc"
): Compte[] {
  const sorted = [...comptes].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return va - vb;
    return String(va).localeCompare(String(vb), "fr");
  });
  return dir === "asc" ? sorted : sorted.reverse();
}
