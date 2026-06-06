import { ClipboardCheck } from "lucide-react";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { RevueActionsClient } from "@/components/revue-actions/revue-actions-client";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = getDb();
  try {
    const rows = await db<{ status: string; count: string }[]>`
      SELECT status, COUNT(*) as count
      FROM revue_actions
      GROUP BY status
    `;
    const pending = Number(rows.find((r) => r.status === "pending")?.count ?? 0);
    const done    = Number(rows.find((r) => r.status === "done")?.count ?? 0);
    const skipped = Number(rows.find((r) => r.status === "skipped")?.count ?? 0);
    return { pending, done, skipped };
  } catch {
    return { pending: 0, done: 0, skipped: 0 };
  }
}

export default async function RevueActionsPage() {
  const enabled = isIntelligenceEnabled();
  const stats = enabled ? await getStats() : { pending: 0, done: 0, skipped: 0 };

  return (
    <main className="container mx-auto max-w-3xl py-5 px-4">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-4 w-4 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Revue des actions</h1>
            <p className="text-xs text-muted-foreground/70">
              Actions recommandées par l&apos;IA — confirme ce qui a été fait, enregistre les détails
            </p>
          </div>
        </div>

        {enabled && (stats.pending + stats.done + stats.skipped) > 0 && (
          <div className="mt-4 flex gap-3">
            <div className="rounded-xl border bg-amber-50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-amber-700">{stats.pending}</p>
              <p className="text-[11px] text-amber-600">En attente</p>
            </div>
            <div className="rounded-xl border bg-emerald-50 px-4 py-2 text-center">
              <p className="text-xl font-bold text-emerald-700">{stats.done}</p>
              <p className="text-[11px] text-emerald-600">Effectuées</p>
            </div>
            <div className="rounded-xl border bg-muted px-4 py-2 text-center">
              <p className="text-xl font-bold text-muted-foreground">{stats.skipped}</p>
              <p className="text-[11px] text-muted-foreground">Ignorées</p>
            </div>
          </div>
        )}
      </header>

      {!enabled ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium">Module désactivé</p>
          <p className="mt-1 text-xs">Configurez <code className="font-mono">DATABASE_URL</code> pour activer la revue des actions.</p>
        </div>
      ) : (
        <RevueActionsClient />
      )}
    </main>
  );
}
