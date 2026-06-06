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
    <main className="container mx-auto max-w-6xl py-5 px-4">
      <header className="mb-5">
        <div
          className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
            border: "1px solid hsl(231 72% 38% / 0.18)",
            color: "hsl(231 72% 36%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Adil BizDev OS · Intelligence
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Base de connaissance</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Index vectoriel des propales, références et méthodos — recherche sémantique avec citations.
        </p>
      </header>

      <ConnaissanceClient intelligenceEnabled={enabled} initialDocs={docs} />
    </main>
  );
}
