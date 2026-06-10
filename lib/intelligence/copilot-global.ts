import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { integrations } from "../config";
import { listComptes } from "../notion";
import { namesMatch } from "../enrichment-match";
import { listPortfolioFeed } from "./journal";
import { getOffreSynthesis } from "./offre-analysis";
import { searchKnowledge } from "./knowledge";
import type { JournalEventType } from "./journal";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const SYSTEM = `Tu es le Copilote BizDev d'Adil Zriouil, Senior Manager TEC chez Sia Partners Maroc.
Tu as une vue d'ensemble de TOUT son portefeuille (comptes, secteurs, scores, stages, signaux de veille, topics demandés, extraits de connaissance Sia).

Réponds en français, de façon CONCISE et ACTIONNABLE (format markdown léger : listes à puces, gras pour les noms de comptes).
Règles :
- Appuie-toi UNIQUEMENT sur le contexte fourni. Ne fabrique pas de chiffres ni de comptes.
- Quand tu cites un compte, écris son nom exact (il servira de lien cliquable).
- Priorise : score AdilStar élevé, stage Hot/Active, signaux récents, échéances.
- Oriente vers les offres Sia (TEC, data/IA, excellence opérationnelle, risque/conformité, ESG).
- Si l'info manque, dis-le franchement.
- Termine si pertinent par 1-3 prochaines actions concrètes.`;

const Schema = z.object({
  answer: z.string().describe("Réponse markdown légère, concise et actionnable, en français."),
  accounts: z.array(z.string()).describe("Noms exacts des comptes cités dans la réponse (pour liens)."),
  suggestions: z.array(z.string()).describe("0 à 3 questions de suivi pertinentes."),
});

export interface PortfolioCopilotResult {
  answer: string;
  accounts: { id: string; nom: string }[];
  suggestions: string[];
  usedRag: boolean;
}

export async function askPortfolioCopilot(question: string): Promise<PortfolioCopilotResult> {
  const comptes = await listComptes();
  const idToNom = new Map(comptes.map((c) => [c.id, c.compte]));

  const portefeuille = comptes
    .slice()
    .sort((a, b) => (b.scoreAdilStar ?? 0) - (a.scoreAdilStar ?? 0))
    .map((c) => ({
      nom: c.compte,
      secteur: c.secteur,
      stage: c.stage,
      priorite: c.priorite,
      statut: c.statutRelation,
      score: c.scoreAdilStar,
      arr: c.arrPondere,
    }));

  // Signaux récents (titres) pour contexte d'actualité.
  const feed = await listPortfolioFeed({
    types: ["signal"] as JournalEventType[],
    sinceDays: 60,
    limit: 60,
  }).catch(() => []);
  const signauxRecents = feed
    .map((e) => ({
      compte: e.accountId ? idToNom.get(e.accountId) ?? "" : "",
      titre: typeof (e.payload as Record<string, unknown>).title === "string" ? (e.payload as Record<string, unknown>).title : "",
    }))
    .filter((s) => s.titre)
    .slice(0, 40);

  // Synthèse offres (topics + offres demandées).
  const synth = await getOffreSynthesis().catch(() => null);
  const topicsChauds = (synth?.hotTopics ?? []).slice(0, 15).map((t) => ({ topic: t.topic, freq: t.frequency }));
  const offresDemandees = (synth?.synthesisRows ?? []).slice(0, 8).map((r) => ({
    offre: r.siaOffer,
    comptes: r.accountCount,
    couverture: r.dominantCoverage,
  }));

  // RAG (optionnel — nécessite EMBEDDINGS_API_KEY).
  let extraitsConnaissance: { titre: string; extrait: string }[] = [];
  let usedRag = false;
  try {
    const hits = await searchKnowledge(question, { k: 6 });
    extraitsConnaissance = hits.map((h) => ({ titre: h.doc.title, extrait: h.chunkText.slice(0, 400) }));
    usedRag = extraitsConnaissance.length > 0;
  } catch {
    /* embeddings indisponibles → on continue sans RAG */
  }

  const context = { portefeuille, signauxRecents, topicsChauds, offresDemandees, extraitsConnaissance };

  const response = await getClient().messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 1600,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      { role: "user", content: `Question : ${question}\n\nContexte portefeuille (JSON) :\n${JSON.stringify(context)}` },
    ],
    output_config: { format: zodOutputFormat(Schema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Le copilote n'a pas renvoyé de réponse.");

  const accounts = (parsed.accounts ?? [])
    .map((nm) => {
      const c = comptes.find((c) => namesMatch(c.compte, nm) || c.compte.toLowerCase() === nm.toLowerCase());
      return c ? { id: c.id, nom: c.compte } : null;
    })
    .filter((x): x is { id: string; nom: string } => x !== null)
    .slice(0, 8);

  return { answer: parsed.answer, accounts, suggestions: (parsed.suggestions ?? []).slice(0, 3), usedRag };
}
