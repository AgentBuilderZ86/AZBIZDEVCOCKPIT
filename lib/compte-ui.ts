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

/** Couleur de badge (classes Tailwind) selon la valeur. */
export function badgeClass(field: keyof typeof SELECT_FIELDS, value: string | null): string {
  if (!value) return "bg-muted text-muted-foreground";
  const map: Record<string, string> = {
    // Priorité
    "🔴 Haute": "bg-red-100 text-red-800",
    "🟡 Moyenne": "bg-yellow-100 text-yellow-800",
    "🟢 Basse": "bg-green-100 text-green-800",
    // Stage
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
  };
  return map[value] ?? "bg-indigo-100 text-indigo-800";
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
