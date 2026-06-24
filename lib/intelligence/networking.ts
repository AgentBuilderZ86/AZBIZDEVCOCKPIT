import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";

/**
 * Zone Networking — recherche web IA d'événements locaux (Maroc) et d'associations
 * professionnelles pour développer le réseau bizdev. Outils serveur Anthropic
 * (web_search + web_fetch). Ne fabrique jamais d'URL : null si introuvable.
 */

export interface NetworkingEvent {
  id: string;
  name: string;
  eventType: string;
  organizer: string;
  location: string;
  city: string;
  eventDate: string | null;
  endDate: string | null;
  description: string;
  websiteUrl: string | null;
  sourceUrl: string | null;
  sector: string;
  audience: string;
  relevanceScore: number | null;
  relevanceNotes: string;
  status: string;
}

export interface NetworkingAssociation {
  id: string;
  name: string;
  assocType: string;
  sector: string;
  city: string;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  description: string;
  membershipInfo: string;
  whyRelevant: string;
  keyContact: Record<string, unknown>;
  status: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const TOOLS = [
  { type: "web_search_20260209", name: "web_search" },
  { type: "web_fetch_20260209", name: "web_fetch" },
] as NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>;

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStr(v: unknown): string {
  return v == null ? "" : String(v).trim();
}
function asStrOrNull(v: unknown): string | null {
  const s = asStr(v);
  return s ? s : null;
}
/** Normalise une date ISO (YYYY-MM-DD) ou null. */
function asDate(v: unknown): string | null {
  const s = asStr(v);
  const m = s.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

async function runWebSearch(
  system: string,
  instruction: string,
  maxTokens: number
): Promise<{ parsed: Record<string, unknown> | null; error: string | null }> {
  if (!integrations.anthropicApiKey) {
    return { parsed: null, error: "Clé ANTHROPIC_API_KEY absente." };
  }
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: instruction }];
  let final: Anthropic.Message | null = null;
  try {
    for (let i = 0; i < 5; i++) {
      const res = await getClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system,
        tools: TOOLS,
        messages,
      });
      if (res.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      final = res;
      break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    return { parsed: null, error: `Recherche web indisponible : ${msg}` };
  }
  if (!final) return { parsed: null, error: "Recherche : trop d'itérations." };

  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { parsed: extractJson(text), error: null };
}

// ─── Événements ──────────────────────────────────────────────────────────────

const EVENTS_SYSTEM = `Tu es un analyste networking pour Sia Partners Maroc (cabinet de conseil).
Tu identifies des événements professionnels MAJEURS et LOCAUX au Maroc, à venir dans les 12 prochains mois,
où un bizdev peut réseauter : salons, forums, conférences sectorielles, petits-déjeuners business, galas,
et événements corporate organisés par les grands groupes locaux (banques, télécoms, OCP, Holmarcom,
assurances, groupes industriels).
Cherche EN PROFONDEUR via web_search et web_fetch : sites officiels des organisateurs, LinkedIn, et presse
économique marocaine (Médias24, L'Économiste, Challenge, Le Matin, Maroc Diplomatique, Le Desk, La Vie Éco)
ainsi que les communiqués/agendas des fédérations et chambres.
Ne fabrique jamais d'URL ni de date : mets null si absent.`;

/** Rendez-vous emblématiques à couvrir impérativement si une édition à venir existe. */
const EVENT_ANCHORS = [
  "CFCIM (Chambre Française de Commerce et d'Industrie du Maroc) — forums, rencontres B2B, mois de l'entreprise",
  "AUSIM — Assises de l'AUSIM et événements SI / digital",
  "GITEX Africa Morocco (Marrakech)",
  "Logismed — salon de la logistique (Casablanca)",
  "SIAM — Salon International de l'Agriculture au Maroc (Meknès)",
  "Salons / sommets data & IA au Maroc (AI events, Morocco AI/Data summits, Devoxx, conférences IA)",
  "Forums sectoriels finance, banque, assurance, industrie, énergie, digital, santé",
  "Grands sommets économiques tenus au Maroc (Africa CEO Forum édition Maroc, forums d'investissement)",
];

const EVENTS_INSTRUCTION = (horizonMonths: number, sector: string | null) =>
  `Trouve 10 à 18 événements professionnels à venir au Maroc${sector ? ` pertinents pour le secteur ${sector}` : ""} dans les ${horizonMonths} prochains mois.
Couvre IMPÉRATIVEMENT, si une édition à venir existe, ces rendez-vous emblématiques :
${EVENT_ANCHORS.map((a) => `- ${a}`).join("\n")}
Renvoie UNIQUEMENT du JSON :
{"events":[{"name":"","eventType":"","organizer":"","city":"","location":"","eventDate":null,"endDate":null,"description":"","websiteUrl":null,"sourceUrl":null,"sector":"","audience":"","relevanceScore":5,"relevanceNotes":""}]}
- "eventType" : salon | forum | conférence | petit-déjeuner | corporate | gala …
- "eventDate"/"endDate" : format YYYY-MM-DD ou null.
- "relevanceScore" : 1-10 (pertinence pour développer un réseau bizdev conseil/data/digital).
- "relevanceNotes" : pourquoi y aller (1 phrase).`;

export async function researchEvents(
  opts: { horizonMonths?: number; sector?: string | null } = {},
  jobId?: string
): Promise<{ inserted: number; error: string | null }> {
  const horizon = opts.horizonMonths ?? 12;
  const { parsed, error } = await runWebSearch(
    EVENTS_SYSTEM,
    EVENTS_INSTRUCTION(horizon, opts.sector ?? null),
    4000
  );
  if (error) return { inserted: 0, error };
  const list = (parsed?.events as Record<string, unknown>[] | undefined) ?? [];
  if (!list.length) return { inserted: 0, error: "Aucun événement structuré trouvé." };

  const db = getDb();
  let inserted = 0;
  for (const e of list) {
    const name = asStr(e.name);
    if (!name) continue;
    const score = Number(e.relevanceScore);
    const rows = await db<{ id: string }[]>`
      INSERT INTO networking_events (
        name, event_type, organizer, location, city, event_date, end_date,
        description, website_url, source_url, sector, audience, relevance_score,
        relevance_notes, job_id
      ) VALUES (
        ${name}, ${asStr(e.eventType)}, ${asStr(e.organizer)}, ${asStr(e.location)}, ${asStr(e.city)},
        ${asDate(e.eventDate)}, ${asDate(e.endDate)}, ${asStr(e.description).slice(0, 1500)},
        ${asStrOrNull(e.websiteUrl)}, ${asStrOrNull(e.sourceUrl)}, ${asStr(e.sector)}, ${asStr(e.audience)},
        ${Number.isFinite(score) ? Math.round(score) : null}, ${asStr(e.relevanceNotes).slice(0, 500)},
        ${jobId ?? null}
      )
      ON CONFLICT (lower(name), COALESCE(event_date, '0001-01-01'::date)) DO NOTHING
      RETURNING id
    `;
    if (rows[0]) inserted++;
  }
  return { inserted, error: null };
}

// ─── Associations ────────────────────────────────────────────────────────────

const ASSOC_SYSTEM = `Tu es un analyste networking pour Sia Partners Maroc.
Tu dresses un annuaire EXHAUSTIF des associations professionnelles, fédérations, chambres de commerce,
clubs business, ordres et think tanks ACTIFS au Maroc, utiles pour développer un réseau bizdev (conseil,
data, digital, finance, industrie). Utilise web_search et web_fetch (sites officiels, LinkedIn).
Ne fabrique jamais d'URL : null si absent.`;

const ASSOC_INSTRUCTION = (sector?: string | null) => `Liste 10 à 20 associations / fédérations / chambres /
clubs business actifs au Maroc${sector ? ` pertinents pour le secteur ${sector}` : ""}.
Renvoie UNIQUEMENT du JSON :
{"associations":[{"name":"","assocType":"","sector":"","city":"","websiteUrl":null,"linkedinUrl":null,"description":"","membershipInfo":"","whyRelevant":"","keyContact":{"nom":null,"titre":null,"email":null,"linkedin":null}}]}
- "assocType" : chambre | fédération | club business | ordre | ONG | think tank …
- "membershipInfo" : conditions/cotisation d'adhésion si connu.
- "whyRelevant" : intérêt pour le réseau bizdev (1 phrase).`;

export async function researchAssociations(
  opts: { sector?: string | null } = {},
  jobId?: string
): Promise<{ inserted: number; error: string | null }> {
  const { parsed, error } = await runWebSearch(
    ASSOC_SYSTEM,
    ASSOC_INSTRUCTION(opts.sector ?? null),
    3500
  );
  if (error) return { inserted: 0, error };
  const list = (parsed?.associations as Record<string, unknown>[] | undefined) ?? [];
  if (!list.length) return { inserted: 0, error: "Aucune association structurée trouvée." };

  const db = getDb();
  let inserted = 0;
  for (const a of list) {
    const name = asStr(a.name);
    if (!name) continue;
    const keyContact =
      a.keyContact && typeof a.keyContact === "object" ? (a.keyContact as Record<string, unknown>) : {};
    const rows = await db<{ id: string }[]>`
      INSERT INTO networking_associations (
        name, assoc_type, sector, city, website_url, linkedin_url, description,
        membership_info, why_relevant, key_contact, job_id
      ) VALUES (
        ${name}, ${asStr(a.assocType)}, ${asStr(a.sector)}, ${asStr(a.city)},
        ${asStrOrNull(a.websiteUrl)}, ${asStrOrNull(a.linkedinUrl)}, ${asStr(a.description).slice(0, 1500)},
        ${asStr(a.membershipInfo).slice(0, 500)}, ${asStr(a.whyRelevant).slice(0, 500)},
        ${db.json(keyContact as Record<string, never>)}, ${jobId ?? null}
      )
      ON CONFLICT (lower(name)) DO NOTHING
      RETURNING id
    `;
    if (rows[0]) inserted++;
  }
  return { inserted, error: null };
}

// ─── Lecture / statut ────────────────────────────────────────────────────────

export async function listEvents(): Promise<NetworkingEvent[]> {
  if (!isIntelligenceEnabled()) return [];
  const db = getDb();
  const rows = await db<Record<string, unknown>[]>`
    SELECT id, name, event_type, organizer, location, city, event_date, end_date,
           description, website_url, source_url, sector, audience, relevance_score,
           relevance_notes, status
    FROM networking_events
    WHERE status <> 'dismissed'
    ORDER BY (event_date IS NULL), event_date ASC, relevance_score DESC NULLS LAST
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    eventType: String(r.event_type ?? ""),
    organizer: String(r.organizer ?? ""),
    location: String(r.location ?? ""),
    city: String(r.city ?? ""),
    eventDate: r.event_date ? new Date(r.event_date as string).toISOString().slice(0, 10) : null,
    endDate: r.end_date ? new Date(r.end_date as string).toISOString().slice(0, 10) : null,
    description: String(r.description ?? ""),
    websiteUrl: (r.website_url as string) ?? null,
    sourceUrl: (r.source_url as string) ?? null,
    sector: String(r.sector ?? ""),
    audience: String(r.audience ?? ""),
    relevanceScore: r.relevance_score == null ? null : Number(r.relevance_score),
    relevanceNotes: String(r.relevance_notes ?? ""),
    status: String(r.status ?? "new"),
  }));
}

export async function listAssociations(): Promise<NetworkingAssociation[]> {
  if (!isIntelligenceEnabled()) return [];
  const db = getDb();
  const rows = await db<Record<string, unknown>[]>`
    SELECT id, name, assoc_type, sector, city, website_url, linkedin_url, description,
           membership_info, why_relevant, key_contact, status
    FROM networking_associations
    WHERE status <> 'dismissed'
    ORDER BY name ASC
    LIMIT 200
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    assocType: String(r.assoc_type ?? ""),
    sector: String(r.sector ?? ""),
    city: String(r.city ?? ""),
    websiteUrl: (r.website_url as string) ?? null,
    linkedinUrl: (r.linkedin_url as string) ?? null,
    description: String(r.description ?? ""),
    membershipInfo: String(r.membership_info ?? ""),
    whyRelevant: String(r.why_relevant ?? ""),
    keyContact: (r.key_contact as Record<string, unknown>) ?? {},
    status: String(r.status ?? "new"),
  }));
}

const VALID_STATUS = new Set(["new", "saved", "dismissed"]);

export async function setEventStatus(id: string, status: string): Promise<boolean> {
  if (!isIntelligenceEnabled() || !VALID_STATUS.has(status)) return false;
  const db = getDb();
  await db`UPDATE networking_events SET status = ${status} WHERE id = ${id}::uuid`;
  return true;
}

export async function setAssociationStatus(id: string, status: string): Promise<boolean> {
  if (!isIntelligenceEnabled() || !VALID_STATUS.has(status)) return false;
  const db = getDb();
  await db`UPDATE networking_associations SET status = ${status} WHERE id = ${id}::uuid`;
  return true;
}
