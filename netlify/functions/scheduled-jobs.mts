import type { Config } from "@netlify/functions";

/**
 * Filet de sécurité horaire — traite les jobs pending/failed non ramassés
 * par scheduled-refresh (qui n'opère qu'une fois par jour à 06:00).
 */
export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  if (!base) {
    return new Response("URL du site indisponible.", { status: 500 });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
  };

  const res = await fetch(`${base}/api/cron/jobs?limit=5`, {
    method: "POST",
    headers,
  });

  const body = await res.text();
  // eslint-disable-next-line no-console
  console.log(`[scheduled-jobs] ${res.status}: ${body.slice(0, 500)}`);

  // Filet horaire pour les jobs networking ORPHELINS (déclenchement /research raté) :
  // /api/cron/jobs les exclut (background-only), donc on relance leur Background Function.
  try {
    const nwRes = await fetch(`${base}/api/networking-bg`, { method: "POST", headers });
    // eslint-disable-next-line no-console
    console.log(`[scheduled-jobs] networking-bg ${nwRes.status}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[scheduled-jobs] networking-bg error: ${String(err)}`);
  }

  return new Response(body, { status: res.status });
}

export const config: Config = {
  schedule: "0 * * * *",
};
