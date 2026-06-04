import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { extractTextFromFile } from "@/lib/intelligence/extract-text";
import {
  ingestKnowledgeDocument,
  type KnowledgeSourceType,
} from "@/lib/intelligence/knowledge";
import { SECTEURS, type Secteur } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "DATABASE_URL absente — ingestion impossible." },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    const titleField = form.get("title");
    const sourceType = (form.get("sourceType") as KnowledgeSourceType) || "upload";
    const sectorRaw = form.get("sector");
    const outcomeRaw = form.get("outcome");
    const accountUrl = (form.get("accountUrl") as string) || null;

    let rawText = (form.get("text") as string) || "";
    let title = typeof titleField === "string" ? titleField.trim() : "";

    if (file instanceof File && file.size > 0) {
      const maxBytes = 8 * 1024 * 1024;
      if (file.size > maxBytes) {
        return NextResponse.json(
          { error: "Fichier trop volumineux (max 8 Mo)." },
          { status: 400 }
        );
      }
      const extracted = await extractTextFromFile(file);
      rawText = extracted.text;
      if (!title) title = extracted.suggestedTitle;
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Fournissez un fichier ou un champ texte." },
        { status: 400 }
      );
    }
    if (!title) title = "Document sans titre";

    let sector: Secteur | null = null;
    if (typeof sectorRaw === "string" && sectorRaw) {
      if (!(SECTEURS as readonly string[]).includes(sectorRaw)) {
        return NextResponse.json({ error: "Secteur invalide." }, { status: 400 });
      }
      sector = sectorRaw as Secteur;
    }

    let outcome: "won" | "lost" | null = null;
    if (outcomeRaw === "won" || outcomeRaw === "lost") outcome = outcomeRaw;

    const result = await ingestKnowledgeDocument({
      title,
      rawText,
      sourceType,
      sector,
      accountUrl,
      outcome,
      metadata: { ingestedAt: new Date().toISOString() },
    });

    return NextResponse.json({ ok: true, ...result, title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur ingestion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
