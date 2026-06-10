/**
 * Rate-limiter best-effort en mémoire (fenêtre glissante) — compatible Edge Runtime.
 *
 * ⚠️ L'état est par instance serverless (non partagé). Utilisé par le middleware
 * (Edge) comme garde large. Pour un quota global robuste sur les routes coûteuses,
 * voir `lib/rate-limit-upstash.ts` (runtime Node uniquement).
 */

export const RL_WINDOW_MS = 60_000; // 1 minute
export const RL_MAX_HITS = 120; // 120 requêtes / minute / IP

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max = RL_MAX_HITS, windowMs = RL_WINDOW_MS): boolean {
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
