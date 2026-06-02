import "server-only";
import {
  getCompte360,
  createContact,
  createSignal,
  updateCompteFields,
} from "./notion";
import { enrichOrganization, searchDecisionMakers } from "./integrations/apollo";
import { generateAccountIntelligence } from "./integrations/claude";
import type {
  ContactDraft,
  EnrichmentApply,
  EnrichmentProposal,
  NiveauInfluence,
} from "./types";

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

/** Construit la proposition d'enrichissement SANS écrire dans Notion. */
export async function buildEnrichmentProposal(
  compteId: string
): Promise<EnrichmentProposal> {
  const { compte, contacts, signaux } = await getCompte360(compteId);

  const warnings: string[] = [];
  const sources: string[] = [];

  // 1. Firmographie + décideurs via Apollo (dégradation propre).
  const firmo = await enrichOrganization(compte.compte);
  let apolloPeople: Awaited<ReturnType<typeof searchDecisionMakers>> = [];
  if (firmo) {
    sources.push("Apollo.io");
    apolloPeople = await searchDecisionMakers(compte.compte, firmo.domain);
  } else {
    warnings.push(
      "Apollo indisponible ou sans résultat — firmographie/décideurs non enrichis."
    );
  }

  // 2. Intelligence Claude (score + plan + signaux).
  let intelligence;
  try {
    intelligence = await generateAccountIntelligence({
      compte,
      firmographics: firmo,
      contacts,
      signaux,
    });
    sources.push("Claude (claude-opus-4-8)");
  } catch (err) {
    warnings.push(
      `Analyse Claude indisponible : ${
        err instanceof Error ? err.message : "erreur inconnue"
      }`
    );
  }

  // 3. Champs compte proposés (ne propose que les changements utiles).
  const proposed: EnrichmentProposal["proposed"] = {};
  if (firmo?.effectif != null && compte.effectif == null)
    proposed.effectif = firmo.effectif;
  if (firmo?.caEstime && !compte.caEstime) proposed.caEstime = firmo.caEstime;
  if (intelligence) {
    proposed.scoreAdilStar = Math.round(intelligence.scoreAdilStar);
    proposed.planStrategique = intelligence.planStrategique;
  }

  // 4. Contacts dédupliqués (sur email/linkedin existants).
  const existingEmails = new Set(
    contacts.map((c) => c.email?.toLowerCase()).filter(Boolean)
  );
  const existingLinkedins = new Set(
    contacts.map((c) => c.linkedin?.toLowerCase()).filter(Boolean)
  );
  const existingNames = new Set(
    contacts.map((c) => c.nomComplet.toLowerCase().trim())
  );
  const newContacts: ContactDraft[] = [];
  for (const p of apolloPeople) {
    if (!p.nomComplet) continue;
    const emailKey = p.email?.toLowerCase();
    const linkedinKey = p.linkedin?.toLowerCase();
    const nameKey = p.nomComplet.toLowerCase().trim();
    if (
      (emailKey && existingEmails.has(emailKey)) ||
      (linkedinKey && existingLinkedins.has(linkedinKey)) ||
      existingNames.has(nameKey)
    )
      continue;
    existingNames.add(nameKey);
    newContacts.push({
      nomComplet: p.nomComplet,
      prenom: p.prenom,
      nom: p.nom,
      titre: p.titre,
      email: p.email,
      linkedin: p.linkedin,
      niveauInfluence: inferInfluence(p.titre),
    });
  }

  // 5. Signaux suggérés, dédupliqués sur le titre.
  const existingSignalTitles = new Set(
    signaux.map((s) => s.titre.toLowerCase().trim())
  );
  const newSignaux = (intelligence?.suggestedSignaux ?? [])
    .filter((s) => !existingSignalTitles.has(s.titre.toLowerCase().trim()))
    .map((s) => ({
      titre: s.titre,
      typeSignal: s.typeSignal,
      scoreOpportunite: s.scoreOpportunite,
      notes: s.notes,
    }));

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
    newSignaux,
    rationale: intelligence?.scoreRationale ?? "",
    warnings,
    sources,
  };
}

/** Applique le sous-ensemble validé : write-back Notion. */
export async function applyEnrichment(
  compteId: string,
  payload: EnrichmentApply
): Promise<{ updatedCompte: boolean; contactsCreated: number; signauxCreated: number }> {
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

  let signauxCreated = 0;
  for (const draft of payload.signaux ?? []) {
    await createSignal(compteId, draft);
    signauxCreated++;
  }

  return { updatedCompte, contactsCreated, signauxCreated };
}
