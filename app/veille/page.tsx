import { Radio } from "lucide-react";
import { IntelligenceFeed } from "@/components/veille/intelligence-feed";

export const dynamic = "force-dynamic";

export default function VeillePage() {
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-aurora-gradient shadow-glow">
            <Radio className="h-5 w-5 text-white" />
          </span>
          Live <span className="text-gradient">Intelligence</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Flux temps réel des signaux du portefeuille — actualités, mouvements de score et de stage —
          avec détection des tendances sectorielles.
        </p>
      </header>

      <IntelligenceFeed />
    </main>
  );
}
