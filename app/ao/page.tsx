import { FileSearch } from "lucide-react";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { listComptes } from "@/lib/notion";
import { AoBoardClient, AoPipelineKpis } from "@/components/ao/ao-board-client";
import type { Ao, AoStatut, Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

function rowToAo(r: Record<string, unknown>): Ao {
  return {
    id: String(r.id ?? ""),
    batchId: String(r.batch_id ?? ""),
    titre: String(r.titre ?? ""),
    client: String(r.client ?? ""),
    datePublication: r.date_publication ? String(r.date_publication).slice(0, 10) : null,
    deadline: r.deadline ? String(r.deadline).slice(0, 10) : null,
    budgetKEur: r.budget_k_eur != null ? Number(r.budget_k_eur) : null,
    description: String(r.description ?? ""),
    sourceUrl: String(r.source_url ?? ""),
    secteur: String(r.secteur ?? ""),
    scoreFit: r.score_fit != null ? Number(r.score_fit) : null,
    synthese: String(r.synthese ?? ""),
    suggestion: String(r.suggestion ?? ""),
    statut: (r.statut as AoStatut) ?? "BO",
    compteNotionId: String(r.compte_notion_id ?? ""),
    compteNom: String(r.compte_nom ?? ""),
    notes: String(r.notes ?? ""),
    importedAt: String(r.imported_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

export default async function AoPage() {
  const intelligenceOn = isIntelligenceEnabled();

  let aos: Ao[] = [];
  let comptes: Compte[] = [];

  if (intelligenceOn) {
    const [db, comptesData] = await Promise.all([
      Promise.resolve(getDb()),
      listComptes().catch(() => [] as Compte[]),
    ]);
    const rows = await db<Record<string, unknown>[]>`
      SELECT * FROM ao_submissions
      ORDER BY deadline ASC NULLS LAST, imported_at DESC
    `.catch(() => []);
    aos = rows.map(rowToAo);
    comptes = comptesData;
  }

  return (
    <main className="container mx-auto max-w-7xl py-5 px-4">
      <header className="mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FileSearch className="h-4 w-4 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pipeline AO</h1>
            <p className="text-xs text-muted-foreground/70">
              Appels d&apos;offres — qualification isolée du pipeline commercial
            </p>
          </div>
        </div>
      </header>

      {!intelligenceOn ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium">Module AO désactivé</p>
          <p className="mt-1 text-xs">Configurez <code className="font-mono">DATABASE_URL</code> pour activer le pipeline AO.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AoPipelineKpis aos={aos} />
          <AoBoardClient initialAos={aos} comptes={comptes} />
        </div>
      )}
    </main>
  );
}
