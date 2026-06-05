import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import type { ApolloPerson } from "./apollo";

/**
 * Recherche de contacts via le web (Google/LinkedIn/charika.ma) en s'appuyant
 * sur les outils serveur d'Anthropic (web_search + web_fetch). Aucune clé tierce :
 * utilise la clé Anthropic. Cible en priorité les fonctions Achats/Procurement.
 * Dégradation propre : { data, error }.
 */

export type WebPerson = ApolloPerson & { telephone: string | null };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const SYSTEM = `Tu es un assistant de prospection B2B pour Sia Partners Maroc.
Tu recherches les décideurs d'entreprises marocaines, en priorité la fonction ACHATS / PROCUREMENT
(pour le référencement fournisseur), puis la direction générale, DSI, finance.
Utilise web_search (Google) et web_fetch. Privilégie LinkedIn et charika.ma (annuaire marocain).
Ne fabrique jamais de coordonnées : ne renvoie un email ou un téléphone que s'il apparaît réellement
dans une source publique. Si une donnée est absente, mets null.`;

const INSTRUCTION = (company: string) => `Entreprise cible : « ${company} » (Maroc).

1. Cherche sur Google des profils LinkedIn de personnes travaillant chez « ${company} », en priorité
   les fonctions Achats / Procurement / Supply Chain, puis direction (DG, DSI, DAF).
2. Consulte la fiche charika.ma de l'entreprise (dirigeants, téléphone, ville) si disponible.
3. Renvoie UNIQUEMENT un objet JSON, sans texte autour, au format :
{"contacts":[{"nomComplet":"","titre":"","linkedin":null,"email":null,"telephone":null,"source":""}]}
Maximum 8 contacts, les plus pertinents (Achats en tête). "source" = URL d'où vient l'info.`;

function extractJson(text: string): any | null {
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

function splitName(full: string): { prenom: string; nom: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { prenom: full.trim(), nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

export async function webResearchContacts(
  company: string
): Promise<{ data: WebPerson[] | null; error: string | null }> {
  if (!integrations.anthropicApiKey)
    return { data: null, error: "Clé ANTHROPIC_API_KEY absente." };

  const tools = [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ] as any;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: INSTRUCTION(company) },
  ];

  try {
    let final: Anthropic.Message | null = null;
    for (let i = 0; i < 4; i++) {
      const res = await getClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3500,
        system: SYSTEM,
        tools,
        messages,
      });
      if (res.stop_reason === "pause_turn") {
        // Boucle d'outils serveur : on relance pour laisser Claude continuer.
        messages.push({ role: "assistant", content: res.content });
        continue;
      }
      final = res;
      break;
    }
    if (!final) return { data: null, error: "Recherche web : trop d'itérations." };

    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const parsed = extractJson(text);
    const contacts: any[] = parsed?.contacts ?? [];
    const people: WebPerson[] = contacts
      .filter((c) => c?.nomComplet)
      .map((c) => {
        const { prenom, nom } = splitName(String(c.nomComplet));
        return {
          nomComplet: String(c.nomComplet).trim(),
          prenom,
          nom,
          titre: c.titre ?? "",
          email: c.email ?? null,
          linkedin: c.linkedin ?? null,
          telephone: c.telephone ?? null,
        };
      });

    return { data: people, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    return { data: null, error: `Recherche web indisponible : ${msg}` };
  }
}
