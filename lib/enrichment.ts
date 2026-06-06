import "server-only";
import {
  getCompte360,
  getCompte,
  createContact,
  createSignal,
  updateCompteFields,
  updateContact,
} from "./notion";
import { alertCriticalSignal } from "./intelligence/slack-alerts";
import {
  enrichOrganization,
  searchDecisionMakers,
  type ApolloPerson,
} from "./integrations/apollo";
import { searchHunterContacts } from "./integrations/hunter";
import { matchExploriumBusiness } from "./integrations/explorium";
import { generateAccountIntelligence } from "./integrations/claude";
import {
  buildContactUpdateProposals,
  mapApolloIndustryToSecteur,
  normalizeName,
  personAlreadyKnown,
} from "./enrichment-match";
import { journalEnrichmentApplied } from "./intelligence/journal-hooks";
import type {
  ContactDraft,
  EnrichmentApply,
  EnrichmentProposal,
  NiveauInfluence,
} from "./types";

/** Limites de plan/quota connues → on n'encombre pas le diff avec ces warnings. */
function isKnownProviderLimit(error: string | null | undefined): boolean {
  if (!error) return false;
  return /(plan apollo gratuit|api_inaccessible|accès api|429|restricted|quota|absente)/i.test(
    error
  );
}

/** Détecte un contact de la fonction Achats (référencement fournisseur). */
function isAchats(titre: string): boolean {
  return /(achat|acheteur|procurement|purchas|sourcing|supply chain|approvisionnement)/i.test(
    titre
  );
}

/** Heuristique : déduit un niveau d'influence à partir du titre. */
function inferInfluence(titre: string): NiveauInfluence | null {
  const t = titre.toLowerCase();
  if (/(ceo|chief executive|directeur général|pdg|président)/.test(t))
    return "Décideur ultime";
  if (/(cfo|chief financial|directeur financier|finance)/.test(t))
    return "Décideur financier";
  if (/(cto|cio|chief technology|chief information|dsi|directeur technique|it)/.test(t))
    return "Décideur technique";
  if (/(director|directeur|vp|vice|head|chief|chef)/.test(t)) return "Décideur";
  if (/(manager|responsable|lead)/.test(t)) return "Influenceur clé";
  return "Influenceur";
}

/** Données brutes collectées lors de la phase 1 (sources externes). */
export interface EnrichmentData {
  compteId: string;
  compte: Awaited<ReturnType<typeof getCompte360>>["compte"];
  contacts: Awaited<ReturnType<typeof getCompte360>>["contacts"];
  signaux: Awaited<ReturnType<typeof getCompte360>>["signaux"];
  firmo: import("./integrations/apollo").ApolloFirmographics | null;
  people: (ApolloPerson & { telephone?: string | null })[];
  phoneMap: Record<string, string>;
  warnings: string[];
  sources: string[];
}

/**
 * Phase 1 : collecte les données externes (Apollo, Hunter, Explorium).
 * Durée estimée : 10-18s. Ne fait aucun appel Claude.
 */
export async function buildEnrichmentData(
  compteId: string
): Promise<EnrichmentData> {
  const { compte, contacts, signaux } = await getCompte360(compteId);

  const warnings: string[] = [];
  const sources: string[] = [];
  const people: (ApolloPerson & { telephone?: string | null })[] = [];

  // 1a. Firmographie Apollo + Explorium en parallèle.
  const [firmoRes, exploriumRes] = await Promise.all([
    enrichOrganization(compte.compte),
    matchExploriumBusiness(compte.compte),
  ]);

  let firmo = firmoRes.data;
  if (firmo) {
    sources.push("Apollo.io");
  } else if (!isKnownProviderLimit(firmoRes.error)) {
    warnings.push(`Firmographie Apollo : ${firmoRes.error}`);
  }

  const explorium = exploriumRes.data;
  if (explorium?.businessId) {
    sources.push("Explorium (match)");
  } else if (
    exploriumRes.error &&
    !isKnownProviderLimit(exploriumRes.error) &&
    !/absente/i.test(exploriumRes.error)
  ) {
    warnings.push(`Explorium : ${exploriumRes.error}`);
  }

  if (!firmo?.domain && explorium?.domain) {
    firmo = firmo
      ? { ...firmo, domain: explorium.domain }
      : { domain: explorium.domain, effectif: null, caEstime: null, industrie: null };
  }

  // 1b. Hunter + décideurs Apollo en parallèle.
  const [hunterRes, peopleRes] = await Promise.all([
    searchHunterContacts(compte.compte, firmo?.domain ?? null),
    firmo
      ? searchDecisionMakers(compte.compte, firmo.domain)
      : Promise.resolve({ data: null as ApolloPerson[] | null, error: null }),
  ]);

  if (peopleRes.error && !isKnownProviderLimit(peopleRes.error))
    warnings.push(`Décideurs Apollo : ${peopleRes.error}`);
  else if (peopleRes.data?.length) people.push(...peopleRes.data);

  if (hunterRes.error) {
    if (!isKnownProviderLimit(hunterRes.error))
      warnings.push(`Contacts Hunter : ${hunterRes.error}`);
  } else if (hunterRes.data?.length) {
    sources.push("Hunter.io");
    people.push(...hunterRes.data);
  }

  // 1c. Téléphones.
  let phoneMap: Record<string, string> = {};
  return { compteId, compte, contacts, signaux, firmo, people, phoneMap, warnings, sources };
}

/**
 * Phase 2 : appelle Claude Opus pour l'intelligence compte, assemble la proposition finale.
 * Durée estimée : 15-25s (sans extended thinking).
 */
export async function buildEnrichmentIntel(
  data: EnrichmentData
): Promise<EnrichmentProposal> {
  const { compteId, compte, contacts, signaux, firmo, people, phoneMap, warnings, sources } = data;
  const allWarnings = [...warnings];
  const allSources = [...sources];

  let intelligence;
  try {
    intelligence = await generateAccountIntelligence({
      compte,
      firmographics: firmo,
      contacts,
      signaux,
    });
    allSources.push("Claude (claude-sonnet-4-6)");
  } catch (err) {
    allWarnings.push(
      `Analyse Claude indisponible : ${err instanceof Error ? err.message : "erreur inconnue"}`
    );
  }

  const proposed: EnrichmentProposal["proposed"] = {};
  if (firmo?.effectif != null && compte.effectif == null) proposed.effectif = firmo.effectif;
  if (firmo?.caEstime && !compte.caEstime) proposed.caEstime = firmo.caEstime;
  const mappedSecteur = mapApolloIndustryToSecteur(firmo?.industrie);
  if (mappedSecteur && !compte.secteur) proposed.secteur = mappedSecteur;
  if (intelligence) {
    proposed.scoreAdilStar = Math.round(intelligence.scoreAdilStar);
    proposed.planStrategique = intelligence.planStrategique;
  }

  const contactUpdates = buildContactUpdateProposals(contacts, people, phoneMap, inferInfluence, isAchats);
  const claimedForNew = new Set(contactUpdates.map((u) => u.contactId));
  const seenNewNames = new Set<string>();

  const newContacts: ContactDraft[] = [];
  for (const p of people) {
    if (!p.nomComplet) continue;
    if (personAlreadyKnown(p, contacts, claimedForNew, seenNewNames)) continue;
    const nameKey = p.nomComplet.toLowerCase().trim();
    seenNewNames.add(normalizeName(p.nomComplet));
    newContacts.push({
      nomComplet: p.nomComplet,
      prenom: p.prenom,
      nom: p.nom,
      titre: p.titre,
      email: p.email,
      linkedin: p.linkedin,
      telephone: p.telephone ?? phoneMap[nameKey] ?? null,
      direction: isAchats(p.titre) ? "Achats" : undefined,
      niveauInfluence: inferInfluence(p.titre),
    });
  }

  const existingSignalTitles = new Set(signaux.map((s: import("./types").Signal) => s.titre.toLowerCase().trim()));
  type SuggestedSignal = NonNullable<typeof intelligence>["suggestedSignaux"][number];
  const newSignaux = (intelligence?.suggestedSignaux ?? [])
    .filter((s: SuggestedSignal) => !existingSignalTitles.has(s.titre.toLowerCase().trim()))
    .map((s: SuggestedSignal) => ({ titre: s.titre, typeSignal: s.typeSignal, scoreOpportunite: s.scoreOpportunite, notes: s.notes }));

  return {
    compteId,
    current: {
      effectif: compte.effectif,
      caEstime: compte.caEstime,
      secteur: compte.secteur,
      scoreAdilStar: compte.scoreAdilStar,
      planStrategique: compte.planStrategique,
    },
    proposed,
    newContacts,
    contactUpdates,
    newSignaux,
    rationale: intelligence?.scoreRationale ?? "",
    warnings: allWarnings,
    sources: allSources,
  };
}

/** Construit la proposition complète en un seul appel (garde la compatibilité). */
export async function buildEnrichmentProposal(
  compteId: string
): Promise<EnrichmentProposal> {
  const data = await buildEnrichmentData(compteId);
  return buildEnrichmentIntel(data);
}

/** Applique le sous-ensemble validé : write-back Notion. */
export async function applyEnrichment(
  compteId: string,
  payload: EnrichmentApply
): Promise<{
  updatedCompte: boolean;
  contactsCreated: number;
  contactsUpdated: number;
  signauxCreated: number;
}> {
  let updatedCompte = false;
  if (payload.compteUpdate && Object.keys(payload.compteUpdate).length > 0) {
    await updateCompteFields(compteId, payload.compteUpdate);
    updatedCompte = true;
  }

  let contactsCreated = 0;
  for (const draft of payload.contacts ?? []) {
    await createContact(compteId, draft);
    contactsCreated++;
  }

  let contactsUpdated = 0;
  for (const { contactId, patch } of payload.contactUpdates ?? []) {
    await updateContact(contactId, patch);
    contactsUpdated++;
  }

  let signauxCreated = 0;
  const criticalSignaux = (payload.signaux ?? []).filter((s) => {
    const n = s.scoreOpportunite ? parseInt(s.scoreOpportunite, 10) : 0;
    return n >= 4;
  });
  if (criticalSignaux.length > 0) {
    const alertCompte = await getCompte(compteId).catch(() => null);
    if (alertCompte) {
      for (const s of criticalSignaux) {
        void alertCriticalSignal(alertCompte, s.titre, s.scoreOpportunite ?? null, s.sourceUrl ?? null).catch(() => {});
      }
    }
  }
  for (const draft of payload.signaux ?? []) {
    await createSignal(compteId, draft);
    signauxCreated++;
  }

  const result = {
    updatedCompte,
    contactsCreated,
    contactsUpdated,
    signauxCreated,
  };
  void journalEnrichmentApplied(compteId, payload, result).catch(() => {
    /* journal optionnel */
  });
  return result;
}
