import type {
  Contact,
  ContactDraft,
  ContactUpdateProposal,
  NiveauInfluence,
  Secteur,
} from "./types";
import type { ApolloPerson } from "./integrations/apollo";

/** Normalise un nom pour comparaison (accents, casse, ponctuation). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeName(name).split(" ").filter((t) => t.length > 1);
}

/** Correspondance floue entre deux noms complets. */
export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  if (ta.size === 0 || tb.size === 0) return false;

  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  let overlap = 0;
  for (const t of Array.from(smaller)) if (larger.has(t)) overlap++;

  if (overlap >= 2 && overlap >= smaller.size) return true;
  if (smaller.size === 1 && overlap === 1) {
    const token = Array.from(smaller)[0];
    return token.length >= 4 && larger.has(token);
  }
  return false;
}

/** Mappe l'industrie Apollo vers les secteurs Notion (heuristique). */
export function mapApolloIndustryToSecteur(
  industrie: string | null | undefined
): Secteur | null {
  if (!industrie) return null;
  const t = industrie.toLowerCase();
  if (/(bank|banque|finance|insurance|assurance|crédit)/.test(t)) return "Banque";
  if (/(mining|mine|fertilizer|engrais|phosphate|metals?)/.test(t))
    return "Mines / Engrais";
  if (/(construction|btp|building|civil|engineering)/.test(t))
    return "BTP / Construction";
  if (/(agri|food|fmcg|consumer|beverage|agro)/.test(t)) return "Agro / FMCG";
  if (/(port|logistic|shipping|transport|warehouse|freight)/.test(t))
    return "Port / Logistique";
  if (/(telecom|telecommunication|mobile|network)/.test(t)) return "Telecom";
  if (/(government|public|administration|municipal)/.test(t)) return "Public";
  if (/(energy|oil|gas|power|utility|énergie|electric)/.test(t)) return "Energie";
  return null;
}

export interface ContactFieldPatch {
  prenom?: string;
  nom?: string;
  titre?: string;
  email?: string | null;
  linkedin?: string | null;
  telephone?: string | null;
  direction?: string;
  niveauInfluence?: NiveauInfluence | null;
}

type Person = ApolloPerson & { telephone?: string | null };

function isEmpty(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

/** Associe une personne enrichie à un contact Notion existant. */
export function findMatchingContact(
  person: Person,
  contacts: Contact[],
  claimed: Set<string>
): Contact | null {
  const emailKey = person.email?.toLowerCase();
  if (emailKey) {
    const byEmail = contacts.find(
      (c) => !claimed.has(c.id) && c.email?.toLowerCase() === emailKey
    );
    if (byEmail) return byEmail;
  }
  const linkedinKey = person.linkedin?.toLowerCase();
  if (linkedinKey) {
    const byLi = contacts.find(
      (c) => !claimed.has(c.id) && c.linkedin?.toLowerCase() === linkedinKey
    );
    if (byLi) return byLi;
  }
  return (
    contacts.find(
      (c) =>
        !claimed.has(c.id) &&
        c.nomComplet &&
        namesMatch(c.nomComplet, person.nomComplet)
    ) ?? null
  );
}

function buildPatchFromPerson(
  contact: Contact,
  person: Person,
  phone: string | null | undefined,
  inferInfluence: (titre: string) => NiveauInfluence | null,
  isAchats: (titre: string) => boolean
): ContactFieldPatch | null {
  const proposed: ContactFieldPatch = {};
  if (isEmpty(contact.prenom) && person.prenom) proposed.prenom = person.prenom;
  if (isEmpty(contact.nom) && person.nom) proposed.nom = person.nom;
  if (isEmpty(contact.titre) && person.titre) proposed.titre = person.titre;
  if (isEmpty(contact.email) && person.email) proposed.email = person.email;
  if (isEmpty(contact.linkedin) && person.linkedin)
    proposed.linkedin = person.linkedin;
  const tel = person.telephone ?? phone ?? null;
  if (isEmpty(contact.telephone) && tel) proposed.telephone = tel;
  if (isEmpty(contact.direction) && person.titre && isAchats(person.titre))
    proposed.direction = "Achats";
  if (!contact.niveauInfluence && person.titre) {
    const inf = inferInfluence(person.titre);
    if (inf) proposed.niveauInfluence = inf;
  }
  return Object.keys(proposed).length > 0 ? proposed : null;
}

/** Propose des mises à jour pour contacts existants (champs vides uniquement). */
export function buildContactUpdateProposals(
  contacts: Contact[],
  people: Person[],
  phoneMap: Record<string, string>,
  inferInfluence: (titre: string) => NiveauInfluence | null,
  isAchats: (titre: string) => boolean
): ContactUpdateProposal[] {
  const claimed = new Set<string>();
  const proposals: ContactUpdateProposal[] = [];

  for (const person of people) {
    if (!person.nomComplet) continue;
    const match = findMatchingContact(person, contacts, claimed);
    if (!match) continue;

    const nameKey = person.nomComplet.toLowerCase().trim();
    const phone = phoneMap[nameKey] ?? phoneMap[normalizeName(person.nomComplet)];
    const proposed = buildPatchFromPerson(
      match,
      person,
      phone,
      inferInfluence,
      isAchats
    );
    if (!proposed) continue;

    claimed.add(match.id);
    const current: ContactFieldPatch = {};
    for (const k of Object.keys(proposed) as (keyof ContactFieldPatch)[]) {
      const cur = match[k as keyof Contact] as string | null | undefined;
      if (k === "niveauInfluence") {
        current.niveauInfluence = match.niveauInfluence;
      } else if (typeof cur === "string" || cur == null) {
        (current as Record<string, unknown>)[k] = cur ?? undefined;
      }
    }

    proposals.push({
      contactId: match.id,
      nomComplet: match.nomComplet,
      current,
      proposed,
    });
  }

  return proposals;
}

/** Indique si une personne correspond déjà à un contact (création à ignorer). */
export function personAlreadyKnown(
  person: Person,
  contacts: Contact[],
  claimedContactIds: Set<string>,
  seenNewNames: Set<string>
): boolean {
  if (findMatchingContact(person, contacts, claimedContactIds)) return true;
  const norm = normalizeName(person.nomComplet);
  if (seenNewNames.has(norm)) return true;
  for (const c of contacts) {
    if (c.nomComplet && namesMatch(c.nomComplet, person.nomComplet)) return true;
  }
  for (const n of Array.from(seenNewNames)) {
    if (namesMatch(n, person.nomComplet)) return true;
  }
  return false;
}
