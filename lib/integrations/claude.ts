import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { integrations } from "../config";
import {
  SCORES_OPPORTUNITE,
  TYPES_SIGNAL,
  type Compte,
  type Contact,
  type Signal,
} from "../types";
import type { ApolloFirmographics } from "./apollo";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

/** Schéma de sortie structuré attendu de Claude. */
const IntelligenceSchema = z.object({
  scoreAdilStar: z
    .number()
    .describe("Score d'attractivité du compte de 0 à 100 (AdilStar)."),
  scoreRationale: z
    .string()
    .describe("Justification concise du score (2-3 phrases)."),
  planStrategique: z
    .string()
    .describe(
      "Plan stratégique compte en français : enjeux, parties prenantes, offres Sia pertinentes, séquence d'approche, prochaines étapes. 250-500 mots."
    ),
  suggestedSignaux: z
    .array(
      z.object({
        titre: z.string(),
        typeSignal: z.enum(TYPES_SIGNAL),
        scoreOpportunite: z.enum(SCORES_OPPORTUNITE),
        notes: z.string(),
      })
    )
    .describe("0 à 4 signaux/angles d'approche déduits du contexte."),
});

export type AccountIntelligence = z.infer<typeof IntelligenceSchema>;

const SYSTEM_PROMPT = `Tu es l'assistant BizDev d'Adil Zriouil, Senior Manager TEC chez Sia Partners Maroc.
Tu analyses des comptes cibles (grandes entreprises marocaines : banques, mines/engrais, BTP, agro, port/logistique, telecom, public, énergie) pour structurer l'approche commerciale de conseil.

Sia Partners est un cabinet de conseil en management et data science. Les offres types : transformation digitale, data/IA, excellence opérationnelle, risque & conformité, ESG, stratégie.

Pour chaque compte, tu produis :
1. Un Score AdilStar (0-100) reflétant l'attractivité = taille/CA × maturité de la relation × intensité des signaux × fit avec les offres Sia.
2. Un plan stratégique actionnable en français.
3. Des signaux/angles d'approche pertinents.

Sois concret, factuel, orienté action. N'invente pas de chiffres précis non fournis ; raisonne sur les éléments donnés.`;

interface IntelligenceInput {
  compte: Compte;
  firmographics: ApolloFirmographics | null;
  contacts: Contact[];
  signaux: Signal[];
}

/** Appelle Claude pour calculer le score AdilStar + rédiger le plan + signaux. */
export async function generateAccountIntelligence(
  input: IntelligenceInput
): Promise<AccountIntelligence> {
  const { compte, firmographics, contacts, signaux } = input;

  const context = {
    compte: {
      nom: compte.compte,
      secteur: compte.secteur,
      priorite: compte.priorite,
      stage: compte.stage,
      statutRelation: compte.statutRelation,
      effectif: compte.effectif,
      caEstime: compte.caEstime,
      planActuel: compte.planStrategique || null,
      notes: compte.notes || null,
    },
    firmographieApollo: firmographics,
    contacts: contacts.map((c) => ({
      nom: c.nomComplet,
      titre: c.titre,
      influence: c.niveauInfluence,
    })),
    signauxExistants: signaux.map((s) => ({
      titre: s.titre,
      type: s.typeSignal,
      score: s.scoreOpportunite,
      statut: s.statut,
    })),
  };

  const response = await getClient().messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Analyse ce compte et produis le score AdilStar, le plan stratégique et les signaux.\n\nContexte (JSON) :\n${JSON.stringify(
          context,
          null,
          2
        )}`,
      },
    ],
    output_config: { format: zodOutputFormat(IntelligenceSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("Claude n'a pas renvoyé de sortie structurée valide.");
  }
  return parsed;
}
