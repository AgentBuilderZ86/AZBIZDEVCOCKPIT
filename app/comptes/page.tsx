import { listComptes } from "@/lib/notion";
import { ComptesClient } from "@/components/comptes/comptes-client";
import { ProcurementRunAllButton } from "@/components/comptes/procurement-run-all-button";
import type { Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComptesPage() {
  let comptes: Compte[] = [];
  let error: string | null = null;

  try {
    comptes = await listComptes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Erreur de chargement Notion.";
  }

  return (
    <main className="container mx-auto max-w-7xl py-5 px-4">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div
            className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
              border: "1px solid hsl(231 72% 38% / 0.18)",
              color: "hsl(231 72% 36%)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Adil BizDev OS · Portefeuille
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Plan de comptes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Édition inline — modifications répercutées dans Notion.</p>
        </div>
        <ProcurementRunAllButton />
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <p className="font-semibold">Impossible de charger les comptes.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
          <p className="mt-2 text-muted-foreground/80">
            Vérifiez <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">NOTION_TOKEN</code> et le partage de la base avec
            l&apos;intégration.
          </p>
        </div>
      ) : (
        <ComptesClient initial={comptes} />
      )}
    </main>
  );
}
