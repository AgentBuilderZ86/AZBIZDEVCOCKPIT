/** Types copilote compte (client-safe). */

export interface CopilotCitation {
  type: string;
  id: string;
  label: string;
  excerpt?: string;
  similarity?: number;
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
