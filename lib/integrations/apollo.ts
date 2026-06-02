import "server-only";
import { integrations } from "../config";

/**
 * Client Apollo.io minimal (REST, server-only).
 * Tous les appels dégradent proprement (retour null + warning) si la clé est
 * absente, si le réseau est bloqué, ou si Apollo renvoie une erreur — l'objectif
 * est que l'enrichissement continue avec les autres sources.
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

async function apolloFetch(path: string, body: unknown): Promise<any | null> {
  const apiKey = integrations.apolloApiKey;
  if (!apiKey) return null;

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
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
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

/** Recherche la firmographie d'une organisation par nom (puis domaine). */
export async function enrichOrganization(
  name: string
): Promise<ApolloFirmographics | null> {
  const data = await apolloFetch("/mixed_companies/search", {
    q_organization_name: name,
    page: 1,
    per_page: 1,
  });
  const org = data?.organizations?.[0] ?? data?.accounts?.[0];
  if (!org) return null;
  return {
    domain: org.primary_domain ?? org.website_url ?? null,
    effectif:
      typeof org.estimated_num_employees === "number"
        ? org.estimated_num_employees
        : null,
    caEstime: formatRevenue(org.annual_revenue ?? org.organization_revenue),
    industrie: org.industry ?? null,
  };
}

/** Recherche des décideurs clés d'une organisation. */
export async function searchDecisionMakers(
  organizationName: string,
  domain: string | null
): Promise<ApolloPerson[]> {
  const titles = [
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

  const data = await apolloFetch("/mixed_people/search", body);
  const people: any[] = data?.people ?? [];
  return people.map((p) => ({
    nomComplet: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    prenom: p.first_name ?? "",
    nom: p.last_name ?? "",
    titre: p.title ?? "",
    email: p.email && !/email_not_unlocked/i.test(p.email) ? p.email : null,
    linkedin: p.linkedin_url ?? null,
  }));
}
