import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function — veille commerciale automatique.
 * S'exécute chaque jour à 07:00 UTC (après le refresh scoring de 06:00)
 * et enfile un job veille.scan pour chaque compte actif non-Dormant.
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

  const res = await fetch(`${base}/api/cron/veille`, {
    method: "POST",
    headers,
  });

  const body = await res.text();
  // eslint-disable-next-line no-console
  console.log(`[scheduled-veille] ${res.status}: ${body.slice(0, 500)}`);

  return new Response(body, { status: res.status });
}

export const config: Config = {
  schedule: "0 7 * * *",
};
