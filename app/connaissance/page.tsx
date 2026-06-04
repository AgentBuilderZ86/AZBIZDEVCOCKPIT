import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConnaissanceClient } from "@/components/connaissance/connaissance-client";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listKnowledgeDocs } from "@/lib/intelligence/knowledge";

export const dynamic = "force-dynamic";

export default async function ConnaissancePage() {
  const enabled = isIntelligenceEnabled();
  let docs: Awaited<ReturnType<typeof listKnowledgeDocs>> = [];

  if (enabled) {
    try {
      docs = await listKnowledgeDocs();
    } catch {
      docs = [];
    }
  }

  return (
    <main className="container mx-auto max-w-6xl py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Accueil
      </Link>

      <header className="mt-3 mb-8">
        <p className="text-sm font-medium text-muted-foreground">Intelligence · Phase 6</p>
        <h1 className="text-2xl font-bold">Base de connaissance</h1>
        <p className="mt-1 text-muted-foreground">
          Index vectoriel des propales, références et méthodos Sia — recherche sémantique avec
          citations.
        </p>
      </header>

      <ConnaissanceClient intelligenceEnabled={enabled} initialDocs={docs} />
    </main>
  );
}
