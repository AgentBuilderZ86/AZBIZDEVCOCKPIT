import "server-only";
import { integrations } from "../config";
import type { ApolloPerson } from "./apollo";

/**
 * Client Hunter.io minimal (server-only) — Domain Search.
 * Renvoie des décideurs avec email à partir du nom de société (ou domaine).
 * Complète Apollo : Hunter excelle sur les contacts/emails, Apollo sur la firmo.
 * Dégradation propre : { data, error }.
 */

const HUNTER_BASE = "https://api.hunter.io/v2";
const TIMEOUT_MS = 12_000;

interface HunterResult {
  data: ApolloPerson[] | null;
  domain: string | null;
  error: string | null;
}

/** Recherche les contacts d'une organisation (par domaine si connu, sinon nom). */
export async function searchHunterContacts(
  company: string,
  domain: string | null
): Promise<HunterResult> {
  const apiKey = integrations.hunterApiKey;
  if (!apiKey) return { data: null, domain: null, error: "Clé HUNTER_API_KEY absente." };

  const params = new URLSearchParams({ api_key: apiKey, limit: "10" });
  if (domain) params.set("domain", domain);
  else params.set("company", company);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HUNTER_BASE}/domain-search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 200);
      try {
        const j = JSON.parse(text);
        msg = j.errors?.[0]?.details ?? j.errors?.[0]?.code ?? msg;
      } catch {
        /* texte brut */
      }
      const hint =
        res.status === 401
          ? " (clé invalide)"
          : res.status === 429
          ? " (quota Hunter dépassé)"
          : "";
      return { data: null, domain: null, error: `Hunter ${res.status}: ${msg}${hint}` };
    }

    const json = JSON.parse(text);
    const resolvedDomain: string | null = json?.data?.domain ?? domain ?? null;
    const emails: any[] = json?.data?.emails ?? [];

    const people: ApolloPerson[] = emails
      .filter((e) => e.type !== "generic" && (e.first_name || e.last_name))
      .map((e) => ({
        nomComplet: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(),
        prenom: e.first_name ?? "",
        nom: e.last_name ?? "",
        titre: e.position ?? "",
        email: e.value ?? null,
        linkedin: e.linkedin ?? null,
      }))
      .filter((p) => p.nomComplet.length > 0);

    return { data: people, domain: resolvedDomain, error: null };
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
        ? err.message
        : "erreur réseau";
    return { data: null, domain: null, error: `Hunter injoignable (${reason}).` };
  } finally {
    clearTimeout(timer);
  }
}
