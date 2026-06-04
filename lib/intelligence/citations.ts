/**
 * Format standard des sources citées dans les réponses IA (Phases 6–10).
 */

export type CitationType =
  | "knowledge_chunk"
  | "notion_signal"
  | "notion_contact"
  | "notion_compte"
  | "journal_event"
  | "apollo"
  | "web";

export interface Citation {
  type: CitationType;
  /** Identifiant stable (UUID chunk, page Notion, etc.). */
  id: string;
  /** Libellé affiché à l'utilisateur. */
  label: string;
  /** Extrait court ou URL. */
  excerpt?: string;
  url?: string;
}

export interface CitedResponse<T = string> {
  content: T;
  citations: Citation[];
  rationale?: string;
}
