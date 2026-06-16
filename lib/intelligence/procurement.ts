import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { integrations } from "../config";
import { getCompte } from "../notion";
import { getDb } from "./db";
import { isIntelligenceEnabled } from "./config";

/**
 * Recherche web du moyen de contact « Direction des Achats » d'un compte
 * + la procédure de référencement fournisseur. S'appuie sur les outils serveur
 * Anthropic (web_search + web_fetch). N'invente jamais d'email/téléphone :
 * ne renvoie une coordonnée que si elle apparaît dans une source publique.
 */

export interface ProcurementResult {
  emailAchats: string | null;
  achatsPhone: string | null;
  referencementUrl: string | null;
  fournisseurPortalUrl: string | null;
  procedureSteps: string[];
  synthese: string;
  sources: string[];
  confidence: "haute" | "moyenne" | "faible" | "";
}

export interface ProcurementRow extends ProcurementResult {
  accountId: string;
  accountNom: string;
  status: string;
  researchedAt: string | null;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: integrations.anthropicApiKey });
  return client;
}

const SYSTEM = `Tu es un assistant achats/référencement B2B pour Sia Partners Maroc.
Ton objectif : trouver comment se faire RÉFÉRENCER comme fournisseur auprès d'une entreprise cible.
Utilise web_search (Google) et web_fetch. Privilégie le site officiel de l'entreprise
(pages « Achats », « Devenir fournisseur », « Espace fournisseurs », « Procurement », « Suppliers »),
puis LinkedIn et charika.ma (annuaire marocain).
Ne fabrique jamais de coordonnées : ne renvoie un email/téléphone/URL que s'il apparaît réellement
dans une source publique. Si une donnée est absente, mets null.`;

const INSTRUCTION = (company: string, sector: string | null) => `Entreprise cible : « ${company} » (Maroc${
  sector ? `, secteur ${sector}` : ""
}).

Trouve le moyen de contacter la Direction des Achats et la procédure de référencement fournisseur :
1. Cherche la page officielle « Achats / Devenir fournisseur / Espace fournisseurs / Procurement » de l'entreprise.
2. Identifie un email de contact achats (ex. achats@, fournisseurs@, procurement@) ou un formulaire/portail fournisseur.
3. Résume la procédure de référencement en étapes concrètes (inscription portail, dossier, agrément, etc.).
4. Renvoie UNIQUEMENT un objet JSON, sans texte autour, au format :
{"emailAchats":null,"achatsPhone":null,"referencementUrl":null,"fournisseurPortalUrl":null,"procedureSteps":[],"synthese":"","sources":[],"confidence":"faible"}
- "procedureSteps" : 2 à 6 étapes courtes (string).
- "sources" : URLs publiques d'où viennent les infos.
- "confidence" : "haute" si email/portail officiel trouvé, "moyenne" si partiel, "faible" si rien de fiable.`;

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

function asStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function asStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

/** Recherche web brute (sans persistance). */
export async function fetchAccountProcurement(
  company: string,
  sector?: string | null
): Promise<{ data: ProcurementResult | null; error: string | null }> {
  if (!integrations.anthropicApiKey) {
    return { data: null, error: "Clé ANTHROPIC_API_KEY absente." };
  }

  const tools = [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ] as NonNullable<Parameters<Anthropic["messages"]["create"]>[0]["tools"]>;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: INSTRUCTION(company, sector ?? null) },
  ];

  let final: Anthropic.Message | null = null;
  try {
    for (let i = 0; i < 4; i++) {
      const res = await getClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM,
        tools,
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
    return { data: null, error: `Recherche web indisponible : ${msg}` };
  }

  if (!final) return { data: null, error: "Recherche achats : trop d'itérations." };

  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const parsed = extractJson(text);
  if (!parsed) return { data: null, error: "Réponse non structurée." };

  const conf = String(parsed.confidence ?? "").toLowerCase();
  const data: ProcurementResult = {
    emailAchats: asStr(parsed.emailAchats),
    achatsPhone: asStr(parsed.achatsPhone),
    referencementUrl: asStr(parsed.referencementUrl),
    fournisseurPortalUrl: asStr(parsed.fournisseurPortalUrl),
    procedureSteps: asStrArray(parsed.procedureSteps),
    synthese: String(parsed.synthese ?? "").trim().slice(0, 1500),
    sources: asStrArray(parsed.sources),
    confidence: conf === "haute" || conf === "moyenne" || conf === "faible" ? conf : "",
  };

  return { data, error: null };
}

/** Recherche + upsert dans account_procurement. Appelé par le job procurement.research. */
export async function researchAccountProcurement(
  compteId: string,
  jobId?: string
): Promise<ProcurementResult> {
  const compte = await getCompte(compteId);
  const { data, error } = await fetchAccountProcurement(compte.compte, compte.secteur);
  if (!data) throw new Error(error ?? "Recherche achats échouée.");

  const hasContact = Boolean(data.emailAchats || data.fournisseurPortalUrl || data.referencementUrl);
  const status = hasContact ? "done" : "empty";

  const db = getDb();
  await db`
    INSERT INTO account_procurement (
      account_id, account_url, account_nom,
      email_achats, achats_phone, referencement_url, fournisseur_portal_url,
      procedure_steps, synthese, sources, confidence,
      status, researched_at, job_id, updated_at
    ) VALUES (
      ${compteId}, ${compte.url ?? ""}, ${compte.compte ?? ""},
      ${data.emailAchats}, ${data.achatsPhone}, ${data.referencementUrl}, ${data.fournisseurPortalUrl},
      ${db.json(data.procedureSteps)}, ${data.synthese}, ${db.json(data.sources)}, ${data.confidence},
      ${status}, now(), ${jobId ?? null}, now()
    )
    ON CONFLICT (account_id) DO UPDATE SET
      account_url = EXCLUDED.account_url,
      account_nom = EXCLUDED.account_nom,
      email_achats = EXCLUDED.email_achats,
      achats_phone = EXCLUDED.achats_phone,
      referencement_url = EXCLUDED.referencement_url,
      fournisseur_portal_url = EXCLUDED.fournisseur_portal_url,
      procedure_steps = EXCLUDED.procedure_steps,
      synthese = EXCLUDED.synthese,
      sources = EXCLUDED.sources,
      confidence = EXCLUDED.confidence,
      status = EXCLUDED.status,
      researched_at = now(),
      job_id = EXCLUDED.job_id,
      updated_at = now()
  `;

  return data;
}

/** Données stockées pour une fiche compte (ou null si jamais recherché). */
export async function getAccountProcurement(compteId: string): Promise<ProcurementRow | null> {
  if (!isIntelligenceEnabled()) return null;
  const db = getDb();
  const rows = await db<
    {
      account_id: string;
      account_nom: string;
      email_achats: string | null;
      achats_phone: string | null;
      referencement_url: string | null;
      fournisseur_portal_url: string | null;
      procedure_steps: string[] | null;
      synthese: string;
      sources: string[] | null;
      confidence: string;
      status: string;
      researched_at: Date | null;
    }[]
  >`
    SELECT account_id, account_nom, email_achats, achats_phone, referencement_url,
           fournisseur_portal_url, procedure_steps, synthese, sources, confidence,
           status, researched_at
    FROM account_procurement
    WHERE account_id = ${compteId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    accountId: r.account_id,
    accountNom: r.account_nom,
    emailAchats: r.email_achats,
    achatsPhone: r.achats_phone,
    referencementUrl: r.referencement_url,
    fournisseurPortalUrl: r.fournisseur_portal_url,
    procedureSteps: r.procedure_steps ?? [],
    synthese: r.synthese,
    sources: r.sources ?? [],
    confidence: (r.confidence as ProcurementResult["confidence"]) ?? "",
    status: r.status,
    researchedAt: r.researched_at ? r.researched_at.toISOString() : null,
  };
}
