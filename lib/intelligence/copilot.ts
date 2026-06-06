import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import { getCompte, listContactsByCompte, listOpportunitesByCompte, listSignauxByCompte } from "../notion";
import { isIntelligenceEnabled, intelligenceConfig } from "./config";
import { searchKnowledge } from "./knowledge";
import { listAccountJournal } from "./journal";
import { buildCitedResponse } from "./cited-response";
import { buildCopilotCitations } from "./copilot-citations";
import type { CopilotResponse } from "./copilot-types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const SYSTEM = `Tu es le copilote BizDev d'Adil Zriouil (Sia Partners Maroc).
Tu réponds en français, de façon concise et actionnable, pour préparer l'approche d'un compte cible.

Règles strictes :
- Cite explicitement les sources du patrimoine Sia fournies (titres des documents entre guillemets).
- Appuie-toi sur le contexte Notion du compte (contacts, signaux, plan) sans inventer de faits.
- Si une information manque, dis-le clairement — ne fabrique pas de références ni de chiffres.
- Oriente vers les offres Sia pertinentes (TEC, data/IA, excellence opérationnelle, risque, ESG).
- Pour les comptes marocains, privilégie les angles sectoriels et les références comparables du RAG.`;

/** Question libre sur un compte : RAG (secteur) + contexte Notion + Claude. */
export async function askAccountCopilot(
  compteId: string,
  question: string
): Promise<CopilotResponse> {
  if (!isIntelligenceEnabled()) {
    throw new Error(
      "Couche Intelligence inactive (DATABASE_URL). Configurez Postgres et migrez."
    );
  }
  if (!intelligenceConfig().embeddingsApiKey) {
    throw new Error("EMBEDDINGS_API_KEY absente — recherche RAG impossible.");
  }
  if (!integrations.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY absente.");
  }

  const trimmed = question.trim();
  if (!trimmed) throw new Error("Question vide.");

  // Étape 1 : compte seul (~1s) — nécessaire pour filtrer le RAG par secteur/url
  const compte = await getCompte(compteId);

  // Étape 2 : relations Notion + RAG + journal en parallèle (~3s au lieu de ~8s séquentiel)
  const [relationsResult, hitsResult, journalResult] = await Promise.allSettled([
    Promise.all([
      listContactsByCompte(compteId),
      listOpportunitesByCompte(compteId),
      listSignauxByCompte(compteId),
    ]),
    (async () => {
      let h = await searchKnowledge(trimmed, {
        sector: compte.secteur,
        accountUrl: compte.url,
        k: 8,
      });
      if (h.length < 3 && compte.secteur) {
        const broader = await searchKnowledge(trimmed, { sector: compte.secteur, k: 10 });
        if (broader.length > h.length) h = broader;
      }
      return h;
    })(),
    listAccountJournal(compte.url, 12).catch(() => [] as Awaited<ReturnType<typeof listAccountJournal>>),
  ]);

  const [contacts, opportunites, signaux] =
    relationsResult.status === "fulfilled" ? relationsResult.value : [[], [], []];
  const hits = hitsResult.status === "fulfilled" ? hitsResult.value : [];
  const journal = journalResult.status === "fulfilled" ? journalResult.value : [];

  const ragBlock =
    hits.length > 0
      ? hits
          .map(
            (h, i) =>
              `[Source ${i + 1}] « ${h.doc.title} » (${h.doc.sourceType}${
                h.doc.outcome ? `, ${h.doc.outcome}` : ""
              })\n${h.chunkText.slice(0, 1200)}`
          )
          .join("\n\n")
      : "Aucun extrait du patrimoine indexé pour cette requête.";

  const notionContext = {
    compte: {
      nom: compte.compte,
      secteur: compte.secteur,
      stage: compte.stage,
      priorite: compte.priorite,
      statutRelation: compte.statutRelation,
      scoreAdilStar: compte.scoreAdilStar,
      effectif: compte.effectif,
      caEstime: compte.caEstime,
      planExtrait: compte.planStrategique?.slice(0, 800) || null,
    },
    contacts: contacts.slice(0, 12).map((c) => ({
      nom: c.nomComplet,
      titre: c.titre,
      influence: c.niveauInfluence,
    })),
    signaux: signaux.slice(0, 8).map((s) => ({
      titre: s.titre,
      type: s.typeSignal,
      score: s.scoreOpportunite,
      statut: s.statut,
    })),
    opportunites: opportunites.slice(0, 6).map((o) => ({
      nom: o.opportunite,
      stage: o.stage,
      montant: o.montant,
    })),
    journalRecent: journal.map((j) => ({
      type: j.eventType,
      date: j.eventDate,
      source: j.source,
      payload: j.payload,
    })),
  };

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Compte cible : ${compte.compte}${
          compte.secteur ? ` (${compte.secteur})` : ""
        }

Question d'Adil :
${trimmed}

--- Patrimoine Sia (extraits RAG) ---
${ragBlock}

--- Contexte Notion (JSON) ---
${JSON.stringify(notionContext, null, 2)}

Réponds en structurant ta réponse : synthèse, références Sia citées, recommandations concrètes.`,
      },
    ],
  });

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cited = buildCitedResponse(
    answer.trim() || "Je n'ai pas pu générer de réponse.",
    buildCopilotCitations(hits, signaux, contacts, journal)
  );

  return {
    answer: cited.content,
    citations: cited.citations,
    sourcesUsed: cited.citations.length,
    rationale: cited.rationale,
  };
}
