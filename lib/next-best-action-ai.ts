import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "./config";
import {
  computeNextBestAction,
  type NextBestAction,
} from "./next-best-action";
import type { Compte, Contact, Opportunite, Signal } from "./types";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

/**
 * NBA enrichi par Claude (Phase 3) avec repli sur l'heuristique.
 */
export async function resolveNextBestAction(
  compte: Compte,
  contacts: Contact[],
  opportunites: Opportunite[],
  signaux: Signal[]
): Promise<NextBestAction> {
  const fallback = computeNextBestAction(
    compte,
    contacts,
    opportunites,
    signaux
  );

  if (!integrations.anthropicApiKey) return fallback;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Tu es copilote BizDev Sia Partners Maroc. Propose UNE seule "next best action" pour ce compte.

Réponds UNIQUEMENT en JSON valide :
{"title":"...","detail":"...","urgency":"high"|"medium"|"low"}

Compte : ${JSON.stringify({
            nom: compte.compte,
            secteur: compte.secteur,
            stage: compte.stage,
            priorite: compte.priorite,
            score: compte.scoreAdilStar,
            planExtrait: compte.planStrategique?.slice(0, 400) ?? null,
          })}
Contacts (${contacts.length}) : ${JSON.stringify(
            contacts.slice(0, 8).map((c) => ({
              nom: c.nomComplet,
              titre: c.titre,
              influence: c.niveauInfluence,
            }))
          )}
Opportunités : ${JSON.stringify(
            opportunites.slice(0, 6).map((o) => ({
              nom: o.opportunite,
              stage: o.stage,
              nextStep: o.nextStep,
              dateNextStep: o.dateNextStep,
            }))
          )}
Signaux : ${JSON.stringify(
            signaux.slice(0, 6).map((s) => ({
              titre: s.titre,
              statut: s.statut,
              score: s.scoreOpportunite,
              type: s.typeSignal,
            }))
          )}

Suggestion heuristique (à challenger ou confirmer) :
${JSON.stringify(fallback)}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const parsed = parseNbaJson(text);
    if (parsed) return parsed;
  } catch {
    /* repli heuristique */
  }

  return fallback;
}

function parseNbaJson(text: string): NextBestAction | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as {
      title?: string;
      detail?: string;
      urgency?: string;
    };
    if (!j.title?.trim() || !j.detail?.trim()) return null;
    const urgency =
      j.urgency === "high" || j.urgency === "medium" || j.urgency === "low"
        ? j.urgency
        : "medium";
    return {
      title: j.title.trim(),
      detail: j.detail.trim(),
      urgency,
    };
  } catch {
    return null;
  }
}
