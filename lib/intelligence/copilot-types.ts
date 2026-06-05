/** Types copilote compte (client-safe). */

const CITATION_TYPE_LABELS: Record<string, string> = {
  knowledge_chunk: "Patrimoine",
  notion_signal: "Signal",
  notion_contact: "Contact",
  notion_compte: "Compte",
  journal_event: "Journal",
  web: "Web",
};

export function citationTypeLabel(type: string): string {
  return CITATION_TYPE_LABELS[type] ?? type;
}

export interface CopilotCitation {
  type: string;
  id: string;
  label: string;
  excerpt?: string;
  similarity?: number;
  url?: string;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  citations?: CopilotCitation[];
}

export interface CopilotResponse {
  answer: string;
  citations: CopilotCitation[];
  /** Extrait RAG utilisés (debug / transparence). */
  sourcesUsed: number;
}
