import { NetworkingClient } from "@/components/networking/networking-client";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listEvents, listAssociations } from "@/lib/intelligence/networking";

export const dynamic = "force-dynamic";

export default async function NetworkingPage() {
  const enabled = isIntelligenceEnabled();
  let events: Awaited<ReturnType<typeof listEvents>> = [];
  let associations: Awaited<ReturnType<typeof listAssociations>> = [];

  if (enabled) {
    try {
      [events, associations] = await Promise.all([listEvents(), listAssociations()]);
    } catch {
      events = [];
      associations = [];
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
          Adil BizDev OS · Networking
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Networking Maroc</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Événements majeurs locaux et associations professionnelles — pistés par recherche web IA
          (sites officiels, LinkedIn, presse) pour développer votre réseau bizdev.
        </p>
      </header>

      <NetworkingClient
        intelligenceEnabled={enabled}
        initialEvents={events}
        initialAssociations={associations}
      />
    </main>
  );
}
