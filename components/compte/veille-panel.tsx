"use client";

import * as React from "react";
import { Newspaper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  compteId: string;
  enabled: boolean;
  onComplete?: () => void;
}

export function VeillePanel({ compteId, enabled, onComplete }: Props) {
  const [loading, setLoading] = React.useState(false);

  async function runVeille(asyncMode: boolean) {
    setLoading(true);
    try {
      const q = asyncMode ? "?async=1" : "";
      const res = await fetch(`/api/compte/${compteId}/veille${q}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Veille impossible.");

      if (data.queued) {
        toast.info(data.message ?? "Veille lancée en arrière-plan.");
        onComplete?.();
        return;
      }

      toast.success(
        `${data.journalEntries ?? 0} actualité(s) ajoutée(s) au journal.`
      );
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
            onClick={() => runVeille(false)}
          >
            {loading ? "Recherche…" : "Lancer la veille"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
