import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { integrations } from "../config";
import { OPP_STAGES } from "../types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

/** Sortie structurée de la classification d'une saisie Drop Zone. */
export const DropClassificationSchema = z.object({
  type: z
    .enum(["contact", "opportunite", "tache", "note"])
    .describe(
      "contact = un nom de personne ; opportunite = un projet/deal commercial ; tache = une action/RDV/appel/relance à faire ; note = un compte-rendu ou note libre."
    ),
  confidence: z.number().min(0).max(1),
  summary: z.string().describe("Résumé d'une ligne de ce qui sera créé, en français."),
  compteQuery: z
    .string()
    .describe("Nom de l'entreprise/compte mentionné, ou chaîne vide si aucun."),
  contact: z
    .object({
      nomComplet: z.string(),
      prenom: z.string().default(""),
      nom: z.string().default(""),
      titre: z.string().default(""),
      email: z.string().default(""),
      linkedin: z.string().default(""),
      telephone: z.string().default(""),
    })
    .nullable()
    .describe("Renseigné uniquement si type=contact."),
  opportunite: z
    .object({
      opportunite: z.string(),
      montant: z.number().nullable().default(null).describe("Montant en k€ si mentionné."),
      stage: z.enum(OPP_STAGES).nullable().default(null),
      nextStep: z.string().default(""),
    })
    .nullable()
    .describe("Renseigné uniquement si type=opportunite."),
  tache: z
    .object({
      titre: z.string(),
      type: z.enum(["todo", "appel"]).default("todo"),
      dueDate: z
        .string()
        .nullable()
        .default(null)
        .describe("Date d'échéance YYYY-MM-DD si déduisible, sinon null."),
    })
    .nullable()
    .describe("Renseigné uniquement si type=tache."),
  note: z
    .object({ texte: z.string() })
    .nullable()
    .describe("Renseigné uniquement si type=note."),
});

export type DropClassification = z.infer<typeof DropClassificationSchema>;

const SYSTEM = `Tu es un assistant de capture rapide pour un CRM BizDev (Sia Partners Maroc).
On te donne une saisie libre tapée à la volée. Détecte la nature de l'élément et extrais des champs structurés.

Règles :
- "Prénom Nom" éventuellement avec un titre et/ou une entreprise => type "contact".
- Un projet, deal, besoin client, montant, périmètre => type "opportunite".
- Une action à faire, relance, RDV, appel, rendez-vous, "rappeler", "envoyer", "préparer" => type "tache" (type appel si c'est un appel/téléphone).
- Un compte-rendu, debrief, note d'échange, "CR", "vu avec", "réunion du" => type "note".
- compteQuery = le nom d'entreprise mentionné s'il y en a un, sinon "".
- La date du jour sert de référence pour interpréter "demain", "lundi", etc. (renvoie YYYY-MM-DD).
- N'invente rien : laisse les champs vides si non fournis. Réponds en français.`;

/** Classe une saisie Drop Zone via Claude (sortie structurée). */
export async function classifyDropInput(input: string): Promise<DropClassification> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await getClient().messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Date du jour : ${today}\n\nSaisie à classer :\n"""${input}"""`,
      },
    ],
    output_config: { format: zodOutputFormat(DropClassificationSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Classification impossible (sortie Claude vide).");
  return parsed;
}
