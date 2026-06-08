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

/** Un objet détecté dans la saisie (la capture peut en contenir plusieurs). */
const DropItemSchema = z.object({
  kind: z
    .enum(["contact", "opportunite", "tache", "note"])
    .describe(
      "contact = une personne ; opportunite = un deal/projet ; tache = une action/RDV/appel à faire ; note = un compte-rendu ou élément de contexte."
    ),
  label: z.string().describe("Résumé court de cet objet, en français."),
  contact: z
    .object({
      nomComplet: z.string(),
      titre: z.string().default(""),
      email: z.string().default(""),
      linkedin: z.string().default(""),
      telephone: z.string().default(""),
      managerName: z
        .string()
        .default("")
        .describe("Nom complet du manager / N+1 de cette personne, s'il est mentionné, sinon vide."),
    })
    .nullable(),
  opportunite: z
    .object({
      opportunite: z.string(),
      montant: z.number().nullable().default(null).describe("Montant en k€ si mentionné."),
      stage: z.enum(OPP_STAGES).nullable().default(null),
      nextStep: z.string().default(""),
    })
    .nullable(),
  tache: z
    .object({
      titre: z.string(),
      type: z.enum(["todo", "appel"]).default("todo"),
      dueDate: z.string().nullable().default(null).describe("YYYY-MM-DD si déduisible, sinon null."),
    })
    .nullable(),
  note: z.object({ texte: z.string() }).nullable(),
});

export const DropPlanSchema = z.object({
  compteQuery: z
    .string()
    .describe("Nom de l'entreprise/compte principal mentionné, ou chaîne vide si aucun."),
  summary: z.string().describe("Résumé global d'une ligne de la capture."),
  items: z
    .array(DropItemSchema)
    .describe("TOUS les objets distincts détectés dans la saisie (peut en contenir plusieurs)."),
});

export type DropItem = z.infer<typeof DropItemSchema>;
export type DropPlan = z.infer<typeof DropPlanSchema>;

const SYSTEM = `Tu es un assistant de capture rapide pour un CRM BizDev (Sia Partners Maroc).
On te donne une saisie libre tapée à la volée. Décompose-la en TOUS les objets distincts qu'elle contient et extrais des champs structurés.

Règles de décomposition :
- Chaque PERSONNE distincte mentionnée (Prénom Nom, éventuellement avec titre/poste) => un objet "contact" séparé.
- Un projet, deal, besoin client, montant, périmètre => un objet "opportunite".
- Une action à faire (relance, RDV, appel, "rappeler", "envoyer", "préparer") => un objet "tache" (type "appel" si téléphone).
- Un compte-rendu, un échange relaté, un contexte d'interaction ("a communiqué", "vu avec", "réunion du", relation hiérarchique N+1) => un objet "note" qui résume l'interaction.
- compteQuery = le nom de l'entreprise commune mentionnée, sinon "".
- Crée bien UN objet contact PAR personne : s'il y a deux personnes, renvoie deux objets contact.
- Si une relation hiérarchique est exprimée ("sa N+1", "son manager", "reporte à", "son patron", "supérieur"), renseigne managerName sur la personne subordonnée avec le nom complet du manager. Ex : "X a transmis à sa N+1 Y" => le contact X a managerName = "Y".
- La date du jour sert de référence pour "demain", "lundi"… (renvoie YYYY-MM-DD).
- N'invente rien : laisse les champs vides si non fournis. Réponds en français.`;

/** Décompose une saisie Drop Zone en plan d'objets via Claude (sortie structurée). */
export async function classifyDropInput(input: string): Promise<DropPlan> {
  const today = new Date().toISOString().slice(0, 10);
  const response = await getClient().messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Date du jour : ${today}\n\nSaisie à décomposer :\n"""${input}"""`,
      },
    ],
    output_config: { format: zodOutputFormat(DropPlanSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Classification impossible (sortie Claude vide).");
  return parsed;
}
