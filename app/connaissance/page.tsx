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
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Base de connaissance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Index vectoriel des propales, références et méthodos — recherche sémantique avec citations.
        </p>
      </header>

      <ConnaissanceClient intelligenceEnabled={enabled} initialDocs={docs} />
    </main>
  );
}
