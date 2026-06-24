import type { Config } from "@netlify/functions";
import { runNetworkingJobs } from "../../lib/intelligence/networking-worker";

/**
 * Background Function — EXÉCUTE la recherche web Networking (événements / associations)
 * directement, avec le budget Netlify des background functions (~15 min).
 *
 * Avant : cette fonction re-déléguait à /api/cron/jobs (route Next.js plafonnée à 26 s),
 * ce qui tuait systématiquement la recherche web (30-90 s) à 24 s. Désormais le travail
 * tourne ICI, dans le bon contexte de temps. Suffixe -background → Netlify répond 202
 * immédiatement au déclencheur (la route /research n'attend pas la fin du job).
 */
export default async function handler(req: Request): Promise<Response> {
  // Auth optionnelle : si CRON_SECRET est défini, on exige le bearer (le déclencheur
  // /api/networking/research l'envoie). Sans secret configuré, on laisse passer.
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const summary = await runNetworkingJobs(2);
    console.log(`[networking-background] ${JSON.stringify(summary)}`);
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    console.error(`[networking-background] ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const config: Config = {
  path: "/api/networking-bg",
};
