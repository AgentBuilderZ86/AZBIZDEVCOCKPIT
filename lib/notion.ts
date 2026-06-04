import "server-only";
import { Client } from "@notionhq/client";
import { notionConfig } from "./config";
import { logWriteback } from "./audit";
import type {
  Compte,
  CompteCreate,
  CompteFieldProposal,
  CompteUpdate,
  Contact,
  ContactDraft,
  SignalDraft,
  NiveauInfluence,
  Opportunite,
  OppStage,
  Priorite,
  PrioriteEngagement,
  ScoreOpportunite,
  Secteur,
  Signal,
  Stage,
  StatutContact,
  StatutRelation,
  StatutSignal,
  TypeSignal,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Client (lazy singleton)                                                    */
/* -------------------------------------------------------------------------- */

let client: Client | null = null;

function getNotionClient(): Client {
  if (!client) {
    const { token } = notionConfig();
    client = new Client({ auth: token });
  }
  return client;
}

/* -------------------------------------------------------------------------- */
/* Retry léger sur erreurs transitoires (429 / 5xx)                           */
/* -------------------------------------------------------------------------- */

async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const transient = status === 429 || (status !== undefined && status >= 500);
    if (transient && retries > 0) {
      await new Promise((r) => setTimeout(r, 600));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* Lecteurs de propriétés Notion → valeurs domaine                            */
/* -------------------------------------------------------------------------- */

/* eslint-disable @typescript-eslint/no-explicit-any */
function readTitle(prop: any): string {
  if (!prop?.title) return "";
  return prop.title.map((t: any) => t.plain_text).join("");
}

function readRichText(prop: any): string {
  if (!prop?.rich_text) return "";
  return prop.rich_text.map((t: any) => t.plain_text).join("");
}

function readSelect(prop: any): string | null {
  return prop?.select?.name ?? null;
}

function readNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}

function readUniqueId(prop: any): number | null {
  return typeof prop?.unique_id?.number === "number"
    ? prop.unique_id.number
    : null;
}

function readDate(prop: any): string | null {
  return prop?.date?.start ?? null;
}

function readEmail(prop: any): string | null {
  return prop?.email ?? null;
}

function readUrl(prop: any): string | null {
  return prop?.url ?? null;
}

function readPhone(prop: any): string | null {
  return prop?.phone_number ?? null;
}

function readFormulaNumber(prop: any): number | null {
  const f = prop?.formula;
  if (!f) return null;
  if (typeof f.number === "number") return f.number;
  return null;
}

export function notionPageToCompte(page: any): Compte {
  const p = page.properties ?? {};
  return {
    id: page.id,
    accountId: readUniqueId(p["Account ID"]),
    compte: readTitle(p["Compte"]),
    secteur: (readSelect(p["Secteur"]) as Secteur | null) ?? null,
    priorite: (readSelect(p["Priorité"]) as Priorite | null) ?? null,
    stage: (readSelect(p["Stage"]) as Stage | null) ?? null,
    statutRelation:
      (readSelect(p["Statut relation"]) as StatutRelation | null) ?? null,
    scoreAdilStar: readNumber(p["Score AdilStar"]),
    arrPondere: readNumber(p["ARR pondéré (k€)"]),
    caEstime: readRichText(p["CA estimé"]),
    effectif: readNumber(p["Effectif"]),
    notes: readRichText(p["Notes"]),
    planStrategique: readRichText(p["Plan stratégique compte"]),
    date: readDate(p["Date"]),
    url: page.url ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/* Écrivains : valeurs domaine → propriétés Notion                            */
/*   - Account ID (auto_increment) : JAMAIS écrit (read-only)                 */
/* -------------------------------------------------------------------------- */

function writeTitle(value: string) {
  return { title: [{ type: "text" as const, text: { content: value } }] };
}

/** Notion plafonne chaque objet rich_text à 2000 caractères → on découpe. */
function writeRichText(value: string) {
  if (!value) return { rich_text: [] };
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += 2000) {
    chunks.push(value.slice(i, i + 2000));
  }
  return {
    rich_text: chunks.map((content) => ({
      type: "text" as const,
      text: { content },
    })),
  };
}

function writeSelect(value: string | null) {
  return { select: value ? { name: value } : null };
}

function writeNumber(value: number | null) {
  return { number: value };
}

function writeDate(value: string | null) {
  return { date: value ? { start: value } : null };
}

/** Construit le payload `properties` Notion à partir d'un patch domaine. */
function compteUpdateToProps(update: CompteUpdate): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (update.compte !== undefined) props["Compte"] = writeTitle(update.compte);
  if (update.secteur !== undefined)
    props["Secteur"] = writeSelect(update.secteur);
  if (update.priorite !== undefined)
    props["Priorité"] = writeSelect(update.priorite);
  if (update.stage !== undefined) props["Stage"] = writeSelect(update.stage);
  if (update.statutRelation !== undefined)
    props["Statut relation"] = writeSelect(update.statutRelation);
  if (update.scoreAdilStar !== undefined)
    props["Score AdilStar"] = writeNumber(update.scoreAdilStar);
  if (update.arrPondere !== undefined)
    props["ARR pondéré (k€)"] = writeNumber(update.arrPondere);
  if (update.caEstime !== undefined)
    props["CA estimé"] = writeRichText(update.caEstime);
  if (update.effectif !== undefined)
    props["Effectif"] = writeNumber(update.effectif);
  if (update.notes !== undefined) props["Notes"] = writeRichText(update.notes);
  if (update.planStrategique !== undefined)
    props["Plan stratégique compte"] = writeRichText(update.planStrategique);
  if (update.date !== undefined) props["Date"] = writeDate(update.date);
  return props;
}

/* -------------------------------------------------------------------------- */
/* API publique du wrapper                                                    */
/* -------------------------------------------------------------------------- */

export interface CompteFilters {
  secteur?: string;
  priorite?: string;
  stage?: string;
  statutRelation?: string;
}

/** Liste tous les comptes (pagination complète). Filtrage appliqué en mémoire. */
export async function listComptes(
  filters?: CompteFilters
): Promise<Compte[]> {
  const { db } = notionConfig();
  const notion = getNotionClient();

  const results: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    const resp: any = await withRetry(() =>
      notion.databases.query({
        database_id: db.comptes,
        start_cursor: cursor,
        page_size: 100,
      })
    );
    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  let comptes = results.map(notionPageToCompte);

  if (filters?.secteur)
    comptes = comptes.filter((c) => c.secteur === filters.secteur);
  if (filters?.priorite)
    comptes = comptes.filter((c) => c.priorite === filters.priorite);
  if (filters?.stage) comptes = comptes.filter((c) => c.stage === filters.stage);
  if (filters?.statutRelation)
    comptes = comptes.filter((c) => c.statutRelation === filters.statutRelation);

  return comptes;
}

export async function getCompte(pageId: string): Promise<Compte> {
  const notion = getNotionClient();
  const page: any = await withRetry(() =>
    notion.pages.retrieve({ page_id: pageId })
  );
  return notionPageToCompte(page);
}

export async function updateCompte(
  pageId: string,
  update: CompteUpdate
): Promise<Compte> {
  const notion = getNotionClient();
  const properties = compteUpdateToProps(update);
  const page: any = await withRetry(() =>
    notion.pages.update({ page_id: pageId, properties: properties as any })
  );
  logWriteback("update", pageId, update);
  return notionPageToCompte(page);
}

export async function createCompte(input: CompteCreate): Promise<Compte> {
  const { db } = notionConfig();
  const notion = getNotionClient();
  const properties = compteUpdateToProps({
    compte: input.compte,
    secteur: input.secteur ?? null,
    priorite: input.priorite ?? null,
    stage: input.stage ?? null,
    statutRelation: input.statutRelation ?? null,
  });
  const page: any = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: db.comptes },
      properties: properties as any,
    })
  );
  logWriteback("create", page.id, { ...input });
  return notionPageToCompte(page);
}

/** Archive = passe le Statut relation à "Dormante" (pas de suppression). */
export async function archiveCompte(pageId: string): Promise<Compte> {
  const result = await updateCompte(pageId, { statutRelation: "Dormante" });
  logWriteback("archive", pageId, { statutRelation: "Dormante" });
  return result;
}

/* -------------------------------------------------------------------------- */
/* Entités liées (vue 360) — mapping + requêtes par relation                  */
/* -------------------------------------------------------------------------- */

function notionPageToContact(page: any): Contact {
  const p = page.properties ?? {};
  return {
    id: page.id,
    contactId: readUniqueId(p["Contact ID"]),
    nomComplet: readTitle(p["Nom complet"]),
    prenom: readRichText(p["Prénom"]),
    nom: readRichText(p["Nom"]),
    titre: readRichText(p["Titre"]),
    email: readEmail(p["Email"]),
    linkedin: readUrl(p["LinkedIn"]),
    telephone: readPhone(p["Téléphone"]),
    direction: readRichText(p["Direction"]),
    roleDecisionnel: readRichText(p["Rôle décisionnel"]),
    niveauInfluence: readSelect(p["Niveau influence"]) as NiveauInfluence | null,
    prioriteEngagement: readSelect(
      p["Priorité engagement"]
    ) as PrioriteEngagement | null,
    statutContact: readSelect(p["Statut contact"]) as StatutContact | null,
    derniereInteraction: readDate(p["Dernière interaction"]),
    notes: readRichText(p["Notes contextuelles"]),
    url: page.url ?? "",
  };
}

function notionPageToOpportunite(page: any): Opportunite {
  const p = page.properties ?? {};
  return {
    id: page.id,
    oppId: readUniqueId(p["Opp ID"]),
    opportunite: readTitle(p["Opportunité"]),
    montant: readNumber(p["Montant (k€)"]),
    probabilite: readNumber(p["Probabilité %"]),
    arrPondere: readFormulaNumber(p["ARR pondéré (k€)"]),
    stage: readSelect(p["Stage"]) as OppStage | null,
    nextStep: readRichText(p["Next step"]),
    dateNextStep: readDate(p["Date next step"]),
    dateClose: readDate(p["Date close prévue"]),
    notes: readRichText(p["Notes"]),
    url: page.url ?? "",
  };
}

function notionPageToSignal(page: any): Signal {
  const p = page.properties ?? {};
  return {
    id: page.id,
    signalId: readUniqueId(p["Signal ID"]),
    titre: readTitle(p["Titre signal"]),
    typeSignal: readSelect(p["Type signal"]) as TypeSignal | null,
    auteur: readRichText(p["Auteur"]),
    dateSignal: readDate(p["Date du signal"]),
    sourceUrl: readUrl(p["Source URL"]),
    scoreOpportunite: readSelect(
      p["Score opportunité"]
    ) as ScoreOpportunite | null,
    statut: readSelect(p["Statut"]) as StatutSignal | null,
    actionPrise: readRichText(p["Action prise"]),
    notes: readRichText(p["Notes"]),
    url: page.url ?? "",
  };
}

/** Requête générique : pages d'une base dont la relation `relationProp` pointe vers `compteId`. */
async function queryByRelation(
  databaseId: string,
  relationProp: string,
  compteId: string
): Promise<any[]> {
  if (!databaseId) return [];
  const notion = getNotionClient();
  const results: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const resp: any = await withRetry(() =>
      notion.databases.query({
        database_id: databaseId,
        filter: {
          property: relationProp,
          relation: { contains: compteId },
        },
        start_cursor: cursor,
        page_size: 100,
      })
    );
    results.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return results;
}

export async function listContactsByCompte(
  compteId: string
): Promise<Contact[]> {
  const { db } = notionConfig();
  const pages = await queryByRelation(db.contacts, "Compte", compteId);
  return pages.map(notionPageToContact);
}

export async function listOpportunitesByCompte(
  compteId: string
): Promise<Opportunite[]> {
  const { db } = notionConfig();
  const pages = await queryByRelation(db.opportunites, "Compte", compteId);
  return pages.map(notionPageToOpportunite);
}

export async function listSignauxByCompte(compteId: string): Promise<Signal[]> {
  const { db } = notionConfig();
  const pages = await queryByRelation(db.signaux, "Compte cible", compteId);
  return pages.map(notionPageToSignal);
}

/** Agrège la vue 360 d'un compte (compte + entités liées) en parallèle. */
export async function getCompte360(compteId: string) {
  const [compte, contacts, opportunites, signaux] = await Promise.all([
    getCompte(compteId),
    listContactsByCompte(compteId),
    listOpportunitesByCompte(compteId),
    listSignauxByCompte(compteId),
  ]);
  return { compte, contacts, opportunites, signaux };
}

/* -------------------------------------------------------------------------- */
/* Écriture des entités liées (enrichissement Phase 3)                        */
/* -------------------------------------------------------------------------- */

function writeEmail(value: string | null | undefined) {
  return { email: value || null };
}
function writeUrl(value: string | null | undefined) {
  return { url: value || null };
}
function writePhone(value: string | null | undefined) {
  return { phone_number: value || null };
}
function writeRelation(pageId: string) {
  return { relation: [{ id: pageId }] };
}

/** Crée un Contact rattaché à un compte. */
export async function createContact(
  compteId: string,
  draft: ContactDraft
): Promise<Contact> {
  const { db } = notionConfig();
  const notion = getNotionClient();
  const props: Record<string, unknown> = {
    "Nom complet": writeTitle(draft.nomComplet),
    Compte: writeRelation(compteId),
    "Statut contact": writeSelect("À identifier"),
  };
  if (draft.prenom) props["Prénom"] = writeRichText(draft.prenom);
  if (draft.nom) props["Nom"] = writeRichText(draft.nom);
  if (draft.titre) props["Titre"] = writeRichText(draft.titre);
  if (draft.direction) props["Direction"] = writeRichText(draft.direction);
  if (draft.email) props["Email"] = writeEmail(draft.email);
  if (draft.linkedin) props["LinkedIn"] = writeUrl(draft.linkedin);
  if (draft.telephone) props["Téléphone"] = writePhone(draft.telephone);
  if (draft.niveauInfluence)
    props["Niveau influence"] = writeSelect(draft.niveauInfluence);

  const page: any = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: db.contacts },
      properties: props as any,
    })
  );
  logWriteback("create", page.id, { type: "contact", ...draft });
  return notionPageToContact(page);
}

/** Met à jour un contact existant (enrichissement — champs ciblés). */
export async function updateContact(
  contactId: string,
  patch: Partial<ContactDraft>
): Promise<Contact> {
  const notion = getNotionClient();
  const props: Record<string, unknown> = {};
  if (patch.prenom !== undefined) props["Prénom"] = writeRichText(patch.prenom);
  if (patch.nom !== undefined) props["Nom"] = writeRichText(patch.nom);
  if (patch.titre !== undefined) props["Titre"] = writeRichText(patch.titre);
  if (patch.direction !== undefined)
    props["Direction"] = writeRichText(patch.direction);
  if (patch.email !== undefined) props["Email"] = writeEmail(patch.email);
  if (patch.linkedin !== undefined) props["LinkedIn"] = writeUrl(patch.linkedin);
  if (patch.telephone !== undefined)
    props["Téléphone"] = writePhone(patch.telephone);
  if (patch.niveauInfluence !== undefined)
    props["Niveau influence"] = writeSelect(patch.niveauInfluence);

  const page: any = await withRetry(() =>
    notion.pages.update({ page_id: contactId, properties: props as any })
  );
  logWriteback("update", contactId, { type: "contact", ...patch });
  return notionPageToContact(page);
}

/** Crée un Signal rattaché à un compte cible. */
export async function createSignal(
  compteId: string,
  draft: SignalDraft
): Promise<Signal> {
  const { db } = notionConfig();
  const notion = getNotionClient();
  const today = new Date().toISOString().slice(0, 10);
  const props: Record<string, unknown> = {
    "Titre signal": writeTitle(draft.titre),
    "Compte cible": writeRelation(compteId),
    Statut: writeSelect("À exploiter"),
    "Date du signal": writeDate(today),
  };
  if (draft.typeSignal) props["Type signal"] = writeSelect(draft.typeSignal);
  if (draft.scoreOpportunite)
    props["Score opportunité"] = writeSelect(draft.scoreOpportunite);
  if (draft.sourceUrl) props["Source URL"] = writeUrl(draft.sourceUrl);
  if (draft.notes) props["Notes"] = writeRichText(draft.notes);

  const page: any = await withRetry(() =>
    notion.pages.create({
      parent: { database_id: db.signaux },
      properties: props as any,
    })
  );
  logWriteback("create", page.id, { type: "signal", ...draft });
  return notionPageToSignal(page);
}

/** Met à jour les champs firmo/score/plan d'un compte (enrichissement). */
export async function updateCompteFields(
  compteId: string,
  fields: CompteFieldProposal
): Promise<Compte> {
  return updateCompte(compteId, {
    effectif: fields.effectif,
    caEstime: fields.caEstime,
    secteur: fields.secteur,
    scoreAdilStar: fields.scoreAdilStar,
    planStrategique: fields.planStrategique,
  });
}
