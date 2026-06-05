import "server-only";
import { integrations } from "../config";

const EXPLORIUM_BASE = "https://api.explorium.ai";
const TIMEOUT_MS = 12_000;

export interface ExploriumMatch {
  businessId: string | null;
  domain: string | null;
  inputName: string | null;
}

interface ExploriumResult<T> {
  data: T | null;
  error: string | null;
}

/** Match une entreprise (name + domain optionnel) → business_id Explorium. */
export async function matchExploriumBusiness(
  companyName: string,
  domain?: string | null
): Promise<ExploriumResult<ExploriumMatch>> {
  const apiKey = integrations.exploriumApiKey;
  if (!apiKey) {
    return { data: null, error: "Clé EXPLORIUM_API_KEY absente." };
  }

  const name = companyName.trim();
  if (!name) {
    return { data: null, error: "Nom de compte vide." };
  }

  const input: Record<string, string> = { name };
  const d = domain?.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  if (d) input.domain = d;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${EXPLORIUM_BASE}/v1/businesses/match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: apiKey,
      },
      body: JSON.stringify({
        businesses_to_match: [input],
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 200);
      try {
        const j = JSON.parse(text);
        msg = j.detail?.[0]?.msg ?? j.message ?? msg;
      } catch {
        /* brut */
      }
      return {
        data: null,
        error: `Explorium HTTP ${res.status} : ${msg}`,
      };
    }

    const json = JSON.parse(text) as {
      matched_businesses?: {
        business_id?: string | null;
        input?: { name?: string; domain?: string };
      }[];
    };

    const row = json.matched_businesses?.[0];
    const businessId = row?.business_id ?? null;
    if (!businessId) {
      return {
        data: { businessId: null, domain: d ?? null, inputName: name },
        error: null,
      };
    }

    return {
      data: {
        businessId,
        domain: row?.input?.domain ?? d ?? null,
        inputName: row?.input?.name ?? name,
      },
      error: null,
    };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "Délai Explorium dépassé."
        : err instanceof Error
          ? err.message
          : "Erreur Explorium.";
    return { data: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
