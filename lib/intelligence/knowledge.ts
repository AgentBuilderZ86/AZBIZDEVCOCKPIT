import "server-only";
import { getDb } from "./db";
import { chunkText } from "./chunking";
import { embedTexts, vectorLiteral } from "./embeddings";
import type { Citation } from "./citations";
import type { Secteur } from "../types";
import { isIntelligenceEnabled } from "./config";

export type KnowledgeSourceType =
  | "propale"
  | "reference"
  | "offre"
  | "methodo"
  | "cr_rdv"
  | "notion_page"
  | "upload";

export type { KnowledgeDocSummary, KnowledgeSearchHit } from "./knowledge-types";
import type { KnowledgeDocSummary, KnowledgeSearchHit } from "./knowledge-types";

export interface IngestInput {
  title: string;
  rawText: string;
  sourceType?: KnowledgeSourceType;
  sector?: Secteur | null;
  accountUrl?: string | null;
  outcome?: "won" | "lost" | null;
  metadata?: Record<string, unknown>;
}

export async function listKnowledgeDocs(): Promise<KnowledgeDocSummary[]> {
  if (!isIntelligenceEnabled()) return [];

  const db = getDb();
  const rows = await db<
    {
      id: string;
      source_type: string;
      title: string;
      sector: string | null;
      outcome: string | null;
      created_at: Date;
      chunk_count: string;
    }[]
  >`
    SELECT d.id, d.source_type, d.title, d.sector, d.outcome, d.created_at,
           COUNT(c.id)::text AS chunk_count
    FROM knowledge_docs d
    LEFT JOIN knowledge_chunks c ON c.doc_id = d.id
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    sourceType: r.source_type,
    title: r.title,
    sector: r.sector,
    outcome: r.outcome,
    chunkCount: parseInt(r.chunk_count, 10) || 0,
    createdAt: r.created_at.toISOString(),
  }));
}

/** Ingère un document : chunk → embeddings → insert. */
export async function ingestKnowledgeDocument(
  input: IngestInput
): Promise<{ docId: string; chunkCount: number }> {
  const chunks = chunkText(input.rawText);
  if (chunks.length === 0) {
    throw new Error("Texte trop court ou vide après extraction.");
  }

  const db = getDb();
  const [doc] = await db<{ id: string }[]>`
    INSERT INTO knowledge_docs (
      source_type, title, sector, account_url, outcome, raw_text, metadata
    ) VALUES (
      ${input.sourceType ?? "upload"},
      ${input.title},
      ${input.sector ?? null},
      ${input.accountUrl ?? null},
      ${input.outcome ?? null},
      ${input.rawText},
      ${db.json((input.metadata ?? {}) as Record<string, never>)}
    )
    RETURNING id
  `;
  const docId = doc.id;

  const embeddings = await embedTexts(chunks, "document");

  for (let i = 0; i < chunks.length; i++) {
    const vec = vectorLiteral(embeddings[i]);
    await db.unsafe(
      `INSERT INTO knowledge_chunks (doc_id, chunk_text, embedding, chunk_index)
       VALUES ($1, $2, $3::vector, $4)`,
      [docId, chunks[i], vec, i]
    );
  }

  return { docId, chunkCount: chunks.length };
}

export async function searchKnowledge(
  query: string,
  opts: {
    sector?: string | null;
    accountUrl?: string | null;
    outcome?: string | null;
    k?: number;
  } = {}
): Promise<KnowledgeSearchHit[]> {
  const k = opts.k ?? 8;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const [queryEmbedding] = await embedTexts([trimmed], "query");
  const vec = vectorLiteral(queryEmbedding);

  const db = getDb();

  const sector = opts.sector ?? null;
  const accountUrl = opts.accountUrl ?? null;
  const outcome = opts.outcome ?? null;

  const rows = await db.unsafe(
    `SELECT
       c.chunk_text,
       c.chunk_index,
       1 - (c.embedding <=> $1::vector) AS similarity,
       d.id AS doc_id,
       d.title,
       d.source_type,
       d.sector,
       d.outcome,
       d.account_url
     FROM knowledge_chunks c
     INNER JOIN knowledge_docs d ON d.id = c.doc_id
     WHERE c.embedding IS NOT NULL
       AND ($2::text IS NULL OR d.sector = $2)
       AND ($3::text IS NULL OR d.account_url = $3)
       AND ($4::text IS NULL OR d.outcome = $4)
     ORDER BY c.embedding <=> $1::vector
     LIMIT $5`,
    [vec, sector, accountUrl, outcome, k]
  );

  return (rows as Record<string, unknown>[]).map((r) => {
    const title = String(r.title);
    const excerpt = String(r.chunk_text).slice(0, 240);
    return {
      chunkText: String(r.chunk_text),
      chunkIndex: Number(r.chunk_index),
      similarity: Number(r.similarity),
      doc: {
        id: String(r.doc_id),
        title,
        sourceType: String(r.source_type),
        sector: r.sector as string | null,
        outcome: r.outcome as string | null,
        accountUrl: r.account_url as string | null,
      },
      citation: {
        type: "knowledge_chunk",
        id: String(r.doc_id),
        label: title,
        excerpt,
      },
    };
  });
}

/** Supprime un document et ses chunks. */
export async function deleteKnowledgeDoc(docId: string): Promise<void> {
  const db = getDb();
  await db`DELETE FROM knowledge_docs WHERE id = ${docId}::uuid`;
}
