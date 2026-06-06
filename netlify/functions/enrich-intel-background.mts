import type { Config } from "@netlify/functions";

/**
 * Background Function — exécute Phase 2 (Claude Sonnet) sans limite de temps.
 * Nommée *-background : Netlify retourne 202 immédiatement et continue en arrière-plan.
 * Délégue le travail au worker Next.js existant (/api/cron/jobs).
 */
export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const secret = process.env.CRON_SECRET ?? "";

  if (!base) {
    console.error("[enrich-intel-background] URL absente (URL/DEPLOY_PRIME_URL).");
    return new Response("URL indisponible.", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/jobs?limit=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.text();
  console.log(`[enrich-intel-background] cron status=${res.status} body=${body.slice(0, 300)}`);
  return new Response(body, { status: res.status });
}

export const config: Config = {
  path: "/api/enrich-intel-bg",
};
