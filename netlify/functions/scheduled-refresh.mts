import type { Config } from "@netlify/functions";

/**
 * Netlify Scheduled Function (Phase 4) — équivalent Netlify de Vercel Cron.
 * S'exécute chaque jour à 06:00 UTC et déclenche la route Next /api/cron/refresh,
 * qui recalcule les scores AdilStar et écrit dans Notion.
 *
 * Le secret CRON_SECRET est transmis en Bearer pour autoriser l'appel.
 */
export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  if (!base) {
    return new Response("URL du site indisponible.", { status: 500 });
  }

  const res = await fetch(`${base}/api/cron/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
    },
  });

  const body = await res.text();
  // eslint-disable-next-line no-console
  console.log(`[scheduled-refresh] ${res.status}: ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
}

export const config: Config = {
  schedule: "0 6 * * *",
};
