import { listComptes } from "@/lib/notion";
import { ComptesClient } from "@/components/comptes/comptes-client";
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
    <main className="container mx-auto max-w-7xl py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Plan de comptes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Édition inline — chaque modification est répercutée dans Notion.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Impossible de charger les comptes.</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
          <p className="mt-2 text-muted-foreground">
            Vérifiez <code>NOTION_TOKEN</code> et le partage de la base avec
            l&apos;intégration.
          </p>
        </div>
      ) : (
        <ComptesClient initial={comptes} />
      )}
    </main>
  );
}
