/**
 * Rate-limiter best-effort en mémoire (fenêtre glissante).
 *
 * ⚠️ Limite : sur Netlify/serverless, l'état est par instance de fonction (non partagé).
 * Cela atténue les rafales sur une même instance mais n'est pas un quota global strict.
 * Pour une protection robuste multi-instances, brancher Upstash Ratelimit (Redis)
 * ou les règles de rate-limiting Netlify Edge.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_HITS = 120; // 120 requêtes / minute / IP

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = MAX_HITS, windowMs = WINDOW_MS): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);

  // Nettoyage occasionnel pour éviter la croissance mémoire.
  if (hits.size > 5_000) {
    hits.forEach((v, k) => {
      if (v.length === 0 || now - v[v.length - 1] > windowMs) hits.delete(k);
    });
  }
  return arr.length <= max;
}
