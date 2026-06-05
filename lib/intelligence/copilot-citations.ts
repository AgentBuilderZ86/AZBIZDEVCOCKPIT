import "server-only";
import type { Contact, Signal } from "../types";
import type { KnowledgeSearchHit } from "./knowledge-types";
import type { CopilotCitation } from "./copilot-types";

type JournalRow = {
  id: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
};

/** Citations multi-sources pour le copilote (P4). */
export function buildCopilotCitations(
  hits: KnowledgeSearchHit[],
  signaux: Signal[],
  contacts: Contact[],
  journal: JournalRow[]
): CopilotCitation[] {
  const out: CopilotCitation[] = [];

  for (const h of hits) {
    out.push({
      type: "knowledge_chunk",
      id: h.citation.id,
      label: h.citation.label,
      excerpt: h.citation.excerpt,
      similarity: h.similarity,
      url: undefined,
    });
  }

  for (const s of signaux.slice(0, 5)) {
    out.push({
      type: "notion_signal",
      id: s.id,
      label: s.titre || "Signal",
      excerpt: [s.typeSignal, s.statut].filter(Boolean).join(" · ") || undefined,
      url: s.url || s.sourceUrl || undefined,
    });
  }

  for (const c of contacts.slice(0, 4)) {
    out.push({
      type: "notion_contact",
      id: c.id,
      label: c.nomComplet || "Contact",
      excerpt: c.titre || undefined,
      url: c.url || c.linkedin || undefined,
    });
  }

  for (const j of journal.slice(0, 4)) {
    const title =
      typeof j.payload.title === "string"
        ? j.payload.title
        : typeof j.payload.note === "string"
          ? String(j.payload.note).slice(0, 80)
          : j.eventType;
    out.push({
      type: "journal_event",
      id: j.id,
      label: `${j.source} · ${title}`,
      excerpt:
        typeof j.payload.summary === "string"
          ? j.payload.summary.slice(0, 120)
          : undefined,
      url:
        typeof j.payload.url === "string" ? (j.payload.url as string) : undefined,
    });
  }

  return out;
}
