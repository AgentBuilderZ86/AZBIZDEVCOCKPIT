import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import { getCompte } from "../notion";
import { appendAccountJournal } from "./journal";

export interface VeilleItem {
  title: string;
  url: string | null;
  summary: string;
  publishedAt?: string | null;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const SYSTEM = `Tu es un analyste veille commerciale pour Sia Partners Maroc.
Tu identifies des actualités récentes et vérifiables sur des comptes cibles (entreprises).
Utilise web_search. Ne fabrique pas d'URL : si l'URL n'est pas trouvée, mets null.
Focus : transformation digitale, appels d'offres, nominations, projets data/IA, partenariats.`;

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Recherche web d'actualités récentes sur un compte. */
export async function fetchAccountVeille(
  companyName: string,
  sector?: string | null
): Promise<{ items: VeilleItem[]; error: string | null }> {
  if (!integrations.anthropicApiKey) {
    return { items: [], error: "ANTHROPIC_API_KEY absente." };
  }

  const sectorHint = sector ? ` secteur ${sector}` : "";
  const instruction = `Entreprise : « ${companyName} » (Maroc${sectorHint}).

Recherche 3 à 5 actualités des 12 derniers mois (presse, site officiel, LinkedIn entreprise).
Renvoie UNIQUEMENT du JSON :
{"items":[{"title":"","url":null,"summary":"","publishedAt":null}]}`;

  const tools = [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ] as NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: instruction }];
  let final: Anthropic.Message | null = null;

  for (let i = 0; i < 6; i++) {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      tools,
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    final = response;
    break;
  }

  if (!final) {
    return { items: [], error: "Veille : trop d'itérations." };
  }

  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text) as { items?: VeilleItem[] } | null;
  if (!parsed?.items?.length) {
    return { items: [], error: "Aucune actualité structurée trouvée." };
  }

  const items = parsed.items
    .filter((it) => it.title?.trim())
    .slice(0, 6)
    .map((it) => ({
      title: String(it.title).trim(),
      url: it.url ? String(it.url) : null,
      summary: String(it.summary ?? "").trim().slice(0, 500),
      publishedAt: it.publishedAt ?? null,
    }));

  return { items, error: null };
}

/** Veille + écriture journal (source news). */
export async function runAccountVeille(accountId: string): Promise<{
  items: VeilleItem[];
  journalIds: string[];
  error: string | null;
}> {
  const compte = await getCompte(accountId);
  const { items, error } = await fetchAccountVeille(
    compte.compte,
    compte.secteur
  );

  if (error && items.length === 0) {
    return { items: [], journalIds: [], error };
  }

  const journalIds: string[] = [];
  for (const item of items) {
    const id = await appendAccountJournal({
      accountUrl: compte.url,
      accountId: compte.id,
      eventType: "signal",
      source: "news",
      payload: {
        title: item.title,
        url: item.url,
        summary: item.summary,
        publishedAt: item.publishedAt,
        via: "veille_scan",
      },
    });
    if (id) journalIds.push(id);
  }

  return { items, journalIds, error };
}
