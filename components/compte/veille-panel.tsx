"use client";

import * as React from "react";
import { Newspaper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseApiJson } from "@/lib/parse-api-json";

interface Props {
  compteId: string;
  enabled: boolean;
  onComplete?: () => void;
}

export function VeillePanel({ compteId, enabled, onComplete }: Props) {
  const [loading, setLoading] = React.useState(false);

  async function pollVeilleJob(jobId: string): Promise<void> {
    const MAX = 20;
    for (let i = 0; i < MAX; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/intelligence/jobs/${jobId}`);
        const data = await parseApiJson(res);
        const job = data.job as { status: string; result?: Record<string, unknown>; error?: string } | undefined;
        if (!job) continue;
        if (job.status === "done") {
          const n = typeof job.result?.itemsFound === "number" ? job.result.itemsFound : 0;
          toast.success(n > 0 ? `${n} actualité(s) ajoutée(s) au journal.` : "Veille terminée — aucune actualité trouvée.");
          onComplete?.();
          return;
        }
        if (job.status === "failed") {
          toast.error(typeof job.error === "string" ? job.error : "Veille échouée.");
          return;
        }
      } catch {
        // erreur réseau transitoire — continuer
      }
    }
    toast.info("Veille en cours — actualisez le journal dans quelques instants.");
    onComplete?.();
  }

  async function runVeille(asyncMode: boolean) {
    setLoading(true);
    try {
      const q = asyncMode ? "?async=1" : "";
      const res = await fetch(`/api/compte/${compteId}/veille${q}`, {
        method: "POST",
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Veille impossible.");

      if (data.queued && typeof data.jobId === "string") {
        await pollVeilleJob(data.jobId);
        return;
      }

      // Mode sync (fallback)
      toast.success(`${data.journalEntries ?? 0} actualité(s) ajoutée(s) au journal.`);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur veille.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Newspaper className="h-4 w-4" />
          Veille commerciale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Recherche web (Claude) des actualités récentes — enregistrées dans le
          journal avec la source « Veille ».
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runVeille(true)}
          >
            {loading ? "Recherche…" : "Lancer la veille"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
