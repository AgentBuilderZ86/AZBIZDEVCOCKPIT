/** Types partagés client/serveur pour la base de connaissance (sans server-only). */

export interface KnowledgeDocSummary {
  id: string;
  sourceType: string;
  title: string;
  sector: string | null;
  outcome: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface KnowledgeSearchHit {
  chunkText: string;
  chunkIndex: number;
  similarity: number;
  doc: {
    id: string;
    title: string;
    sourceType: string;
    sector: string | null;
    outcome: string | null;
    accountUrl: string | null;
  };
  citation: {
    type: string;
    id: string;
    label: string;
    excerpt?: string;
  };
}
