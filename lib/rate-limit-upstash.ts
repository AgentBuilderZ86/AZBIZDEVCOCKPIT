import "server-only";
import { rateLimit, RL_MAX_HITS } from "./rate-limit";

/**
 * Rate-limiting robuste pour routes coûteuses (runtime Node uniquement — PAS Edge).
 *
 * - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont définis → quota global
 *   partagé entre instances (Upstash Redis, fenêtre glissante).
 * - Sinon → repli best-effort en mémoire (par instance).
 *
 * ⚠️ Ne pas importer depuis le middleware (Edge Runtime) : `@upstash/redis` utilise
 * des API Node non supportées en Edge.
 */

let upstashInit = false;
let upstashLimiter: { limit: (k: string) => Promise<{ success: boolean }> } | null = null;

async function getUpstashLimiter() {
  if (upstashInit) return upstashLimiter;
  upstashInit = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    upstashLimiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(RL_MAX_HITS, "1 m"),
      prefix: "rl",
    });
  } catch {
    upstashLimiter = null;
  }
  return upstashLimiter;
}

/** Vérifie le quota (Upstash si configuré, sinon mémoire). Retourne true si autorisé. */
export async function checkRateLimit(key: string): Promise<boolean> {
  const limiter = await getUpstashLimiter();
  if (limiter) {
    try {
      const { success } = await limiter.limit(key);
      return success;
    } catch {
      // Upstash indisponible → repli mémoire.
    }
  }
  return rateLimit(key);
}

/** Extrait l'IP client d'une requête (Netlify / proxy). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
