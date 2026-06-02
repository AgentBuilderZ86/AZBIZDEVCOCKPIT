import "server-only";
import { integrations } from "../config";

/**
 * Client Apollo.io minimal (REST, server-only).
 * Les appels renvoient { data, error } : `error` porte la cause précise (statut
 * HTTP + message Apollo) afin d'être affichée dans le diff d'enrichissement.
 * L'enrichissement continue malgré une erreur Apollo (les autres sources restent).
 */

const APOLLO_BASE = "https://api.apollo.io/api/v1";
const TIMEOUT_MS = 12_000;

export interface ApolloFirmographics {
  domain: string | null;
  effectif: number | null;
  caEstime: string | null;
  industrie: string | null;
}

export interface ApolloPerson {
  nomComplet: string;
  prenom: string;
  nom: string;
  titre: string;
  email: string | null;
  linkedin: string | null;
}

interface ApolloResult<T> {
  data: T | null;
  error: string | null;
}

async function apolloRequest(
  path: string,
  body: unknown
): Promise<ApolloResult<any>> {
  const apiKey = integrations.apolloApiKey;
  if (!apiKey) return { data: null, error: "Clé APOLLO_API_KEY absente." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${APOLLO_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 200);
      let code = "";
      try {
        const j = JSON.parse(text);
        msg = j.error ?? j.message ?? j.error_message ?? msg;
        code = j.error_code ?? "";
      } catch {
        /* texte brut */
      }
      // Cas fréquent : plan Apollo gratuit → API de recherche bloquée.
      if (code === "API_INACCESSIBLE" || /free plan/i.test(msg)) {
        return {
          data: null,
          error:
            "Plan Apollo gratuit : l'API de recherche (firmographie & décideurs) nécessite un plan payant avec accès API. Upgrade : https://app.apollo.io/ — l'enrichissement Claude (score, plan, signaux) reste disponible.",
        };
      }
      const hint =
        res.status === 401
          ? " (clé invalide)"
          : res.status === 403
          ? " (accès API non inclus dans le plan Apollo)"
          : "";
      return { data: null, error: `Apollo ${res.status}: ${msg}${hint}` };
    }

    return { data: JSON.parse(text), error: null };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
        ? err.message
        : "erreur réseau";
    return { data: null, error: `Apollo injoignable (${reason}).` };
  } finally {
    clearTimeout(timer);
  }
}

function formatRevenue(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!n || Number.isNaN(n)) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Md$`;
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)} M$`;
  return `${Math.round(n)} $`;
}

/** Firmographie d'une organisation par nom. */
export async function enrichOrganization(
  name: string
): Promise<ApolloResult<ApolloFirmographics>> {
  const { data, error } = await apolloRequest("/mixed_companies/search", {
    q_organization_name: name,
    page: 1,
    per_page: 1,
  });
  if (error) return { data: null, error };

  const org = data?.organizations?.[0] ?? data?.accounts?.[0];
  if (!org)
    return { data: null, error: `Aucune entreprise trouvée pour « ${name} ».` };

  return {
    data: {
      domain: org.primary_domain ?? org.website_url ?? null,
      effectif:
        typeof org.estimated_num_employees === "number"
          ? org.estimated_num_employees
          : null,
      caEstime: formatRevenue(org.annual_revenue ?? org.organization_revenue),
      industrie: org.industry ?? null,
    },
    error: null,
  };
}

/** Décideurs clés d'une organisation. */
export async function searchDecisionMakers(
  organizationName: string,
  domain: string | null
): Promise<ApolloResult<ApolloPerson[]>> {
  const titles = [
    // Achats / Procurement (prioritaires pour le référencement fournisseur Sia)
    "Acheteur",
    "Responsable Achats",
    "Directeur Achats",
    "Chief Procurement Officer",
    "Head of Procurement",
    "Procurement",
    "Purchasing",
    "Sourcing",
    "Supply Chain",
    // Décideurs généraux
    "CEO",
    "Chief Executive Officer",
    "Director",
    "Directeur",
    "VP",
    "Head",
    "Chief",
    "Manager",
  ];
  const body: Record<string, unknown> = {
    person_titles: titles,
    page: 1,
    per_page: 8,
  };
  if (domain) body["q_organization_domains_list"] = [domain];
  else body["q_organization_name"] = organizationName;

  const { data, error } = await apolloRequest("/mixed_people/search", body);
  if (error) return { data: null, error };

  const people: any[] = data?.people ?? [];
  return {
    data: people.map((p) => ({
      nomComplet: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      prenom: p.first_name ?? "",
      nom: p.last_name ?? "",
      titre: p.title ?? "",
      email: p.email && !/email_not_unlocked/i.test(p.email) ? p.email : null,
      linkedin: p.linkedin_url ?? null,
    })),
    error: null,
  };
}

function firstPhone(p: any): string | null {
  const n = p?.phone_numbers?.[0]?.raw_number ?? p?.sanitized_phone ?? p?.organization?.phone ?? null;
  return n || null;
}

/**
 * Révèle les téléphones via People Bulk Match (reveal_phone_number).
 * Renvoie une map nomComplet (minuscule) → téléphone. Nécessite un plan Apollo
 * avec accès API + crédits téléphone ; dégradation propre sinon.
 */
export async function revealPhones(
  people: { prenom: string; nom: string; nomComplet: string }[],
  domain: string | null
): Promise<ApolloResult<Record<string, string>>> {
  const targets = people.filter((p) => p.prenom || p.nom).slice(0, 10);
  if (targets.length === 0) return { data: {}, error: null };

  const details = targets.map((p) => ({
    first_name: p.prenom,
    last_name: p.nom,
    ...(domain ? { domain } : {}),
  }));

  const { data, error } = await apolloRequest("/people/bulk_match", {
    details,
    reveal_phone_number: true,
  });
  if (error) return { data: null, error };

  const map: Record<string, string> = {};
  for (const m of data?.matches ?? []) {
    const name = (m?.name ?? `${m?.first_name ?? ""} ${m?.last_name ?? ""}`)
      .toLowerCase()
      .trim();
    const phone = firstPhone(m);
    if (name && phone) map[name] = phone;
  }
  return { data: map, error: null };
}
