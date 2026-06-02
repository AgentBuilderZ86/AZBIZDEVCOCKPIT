/**
 * Types domaine alignés EXACTEMENT sur les options de la base Notion 🏢 Comptes.
 * Les strings (avec emojis pour Priorité) doivent correspondre au schéma Notion.
 */

export const SECTEURS = [
  "Banque",
  "Mines / Engrais",
  "BTP / Construction",
  "Agro / FMCG",
  "Port / Logistique",
  "Telecom",
  "Public",
  "Energie",
] as const;
export type Secteur = (typeof SECTEURS)[number];

export const PRIORITES = ["🔴 Haute", "🟡 Moyenne", "🟢 Basse"] as const;
export type Priorite = (typeof PRIORITES)[number];

export const STAGES = ["Cold", "Warm", "Hot", "Active", "Won", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

export const STATUTS_RELATION = [
  "Active",
  "À développer",
  "À prospecter",
  "Dormante",
] as const;
export type StatutRelation = (typeof STATUTS_RELATION)[number];

/** Représentation domaine d'un compte (page Notion mappée). */
export interface Compte {
  /** Page ID Notion (utilisé pour update/retrieve). */
  id: string;
  /** Account ID auto-increment — read-only, jamais écrit. */
  accountId: number | null;
  compte: string;
  secteur: Secteur | null;
  priorite: Priorite | null;
  stage: Stage | null;
  statutRelation: StatutRelation | null;
  scoreAdilStar: number | null;
  arrPondere: number | null;
  caEstime: string;
  effectif: number | null;
  notes: string;
  planStrategique: string;
  date: string | null;
  url: string;
}

/** Champs éditables d'un compte (write-back). `id` exclu. */
export type CompteUpdate = Partial<Omit<Compte, "id" | "accountId" | "url">>;

/** Champs requis pour la création. */
export interface CompteCreate {
  compte: string;
  secteur?: Secteur | null;
  priorite?: Priorite | null;
  stage?: Stage | null;
  statutRelation?: StatutRelation | null;
}
