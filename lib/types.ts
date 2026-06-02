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

/* -------------------------------------------------------------------------- */
/* Entités liées (vue 360) — lecture seule pour l'instant                     */
/* -------------------------------------------------------------------------- */

export const NIVEAUX_INFLUENCE = [
  "Décideur ultime",
  "Décideur",
  "Décideur technique",
  "Décideur financier",
  "Influenceur clé",
  "Influenceur",
  "Prescripteur",
] as const;
export type NiveauInfluence = (typeof NIVEAUX_INFLUENCE)[number];

export const PRIORITES_ENGAGEMENT = ["🔴 P1", "🟡 P2", "🟢 P3"] as const;
export type PrioriteEngagement = (typeof PRIORITES_ENGAGEMENT)[number];

export const STATUTS_CONTACT = [
  "Identifié",
  "À identifier",
  "Contacté",
  "Engagé",
  "Inactif",
] as const;
export type StatutContact = (typeof STATUTS_CONTACT)[number];

export interface Contact {
  id: string;
  contactId: number | null;
  nomComplet: string;
  prenom: string;
  nom: string;
  titre: string;
  email: string | null;
  linkedin: string | null;
  telephone: string | null;
  direction: string;
  roleDecisionnel: string;
  niveauInfluence: NiveauInfluence | null;
  prioriteEngagement: PrioriteEngagement | null;
  statutContact: StatutContact | null;
  derniereInteraction: string | null;
  notes: string;
  url: string;
}

export const OPP_STAGES = [
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
] as const;
export type OppStage = (typeof OPP_STAGES)[number];

export interface Opportunite {
  id: string;
  oppId: number | null;
  opportunite: string;
  montant: number | null;
  probabilite: number | null;
  /** Formule Notion — read-only. */
  arrPondere: number | null;
  stage: OppStage | null;
  nextStep: string;
  dateNextStep: string | null;
  dateClose: string | null;
  notes: string;
  url: string;
}

export const TYPES_SIGNAL = [
  "Post Sia",
  "Post compte cible",
  "Post influenceur",
  "Recrutement clé",
  "News / Press",
  "Mouvement dirigeant",
  "RFP / Tender",
] as const;
export type TypeSignal = (typeof TYPES_SIGNAL)[number];

export const SCORES_OPPORTUNITE = [
  "5 - Critique",
  "4 - Élevé",
  "3 - Moyen",
  "2 - Faible",
  "1 - À surveiller",
] as const;
export type ScoreOpportunite = (typeof SCORES_OPPORTUNITE)[number];

export const STATUTS_SIGNAL = [
  "À exploiter",
  "En cours",
  "Exploité",
  "Archivé",
] as const;
export type StatutSignal = (typeof STATUTS_SIGNAL)[number];

export interface Signal {
  id: string;
  signalId: number | null;
  titre: string;
  typeSignal: TypeSignal | null;
  auteur: string;
  dateSignal: string | null;
  sourceUrl: string | null;
  scoreOpportunite: ScoreOpportunite | null;
  statut: StatutSignal | null;
  actionPrise: string;
  notes: string;
  url: string;
}

/** Vue 360 agrégée d'un compte. */
export interface Compte360 {
  compte: Compte;
  contacts: Contact[];
  opportunites: Opportunite[];
  signaux: Signal[];
}

/* -------------------------------------------------------------------------- */
/* Enrichissement (Phase 3) — propositions à valider avant write-back          */
/* -------------------------------------------------------------------------- */

/** Brouillon de contact proposé par l'enrichissement (non encore écrit). */
export interface ContactDraft {
  nomComplet: string;
  prenom?: string;
  nom?: string;
  titre?: string;
  email?: string | null;
  linkedin?: string | null;
  telephone?: string | null;
  direction?: string;
  niveauInfluence?: NiveauInfluence | null;
}

/** Brouillon de signal proposé par l'enrichissement. */
export interface SignalDraft {
  titre: string;
  typeSignal?: TypeSignal | null;
  scoreOpportunite?: ScoreOpportunite | null;
  sourceUrl?: string | null;
  notes?: string;
}

/** Champs du compte que l'enrichissement propose de modifier. */
export interface CompteFieldProposal {
  effectif?: number | null;
  caEstime?: string;
  secteur?: Secteur | null;
  scoreAdilStar?: number | null;
  planStrategique?: string;
}

/** Proposition d'enrichissement complète, présentée en diff avant validation. */
export interface EnrichmentProposal {
  compteId: string;
  /** Valeurs actuelles (pour afficher le diff). */
  current: CompteFieldProposal;
  /** Valeurs proposées (n'inclut que ce qui change). */
  proposed: CompteFieldProposal;
  newContacts: ContactDraft[];
  newSignaux: SignalDraft[];
  /** Explication Claude du scoring et du plan. */
  rationale: string;
  /** Avertissements non bloquants (ex. source indisponible). */
  warnings: string[];
  sources: string[];
}

/** Payload d'application (sous-ensemble validé par l'utilisateur). */
export interface EnrichmentApply {
  compteUpdate?: CompteFieldProposal;
  contacts?: ContactDraft[];
  signaux?: SignalDraft[];
}
