import type { Citation, CitedResponse } from "./citations";

/** Construit une réponse IA standardisée avec sources. */
export function buildCitedResponse(
  content: string,
  citations: Citation[],
  rationale?: string
): CitedResponse {
  return {
    content: content.trim(),
    citations: dedupeCitations(citations),
    rationale,
  };
}

/** Supprime les doublons (type + id). */
export function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of citations) {
    const key = `${c.type}:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Convertit une Citation en badge copilote (similarité optionnelle). */
export function citationToCopilotBadge(
  c: Citation,
  extra?: { similarity?: number }
): Citation & { similarity?: number } {
  return { ...c, similarity: extra?.similarity };
}
