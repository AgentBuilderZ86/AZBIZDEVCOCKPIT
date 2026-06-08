"use client";

import * as React from "react";
import { CheckCircle2, Trash2, Phone, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseApiJson } from "@/lib/parse-api-json";
import type { TacheRow } from "@/lib/types";

const PRIORITE_COLORS: Record<string, string> = {
  haute: "bg-red-100 text-red-700 border-red-200",
  moyenne: "bg-amber-100 text-amber-700 border-amber-200",
  basse: "bg-slate-100 text-slate-600 border-slate-200",
};

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  taches: TacheRow[];
  onChange?: (taches: TacheRow[]) => void;
  emptyLabel?: string;
}

export function TachesList({ taches, onChange, emptyLabel = "Aucune tâche." }: Props) {
  const [items, setItems] = React.useState<TacheRow[]>(taches);

  React.useEffect(() => setItems(taches), [taches]);

  function update(next: TacheRow[]) {
    setItems(next);
    onChange?.(next);
  }

  async function markDone(id: string) {
    const next = items.filter((t) => t.id !== id);
    update(next);
    try {
      const res = await fetch(`/api/taches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
      update(items); // rollback
    }
  }

  async function remove(id: string) {
    const next = items.filter((t) => t.id !== id);
    update(next);
    try {
      const res = await fetch(`/api/taches/${id}`, { method: "DELETE" });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
      update(items); // rollback
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((t) => {
        const overdue = t.due_date != null && daysUntil(t.due_date) < 0;
        const soon = t.due_date != null && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) < 7;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              overdue ? "border-red-200 bg-red-50/40" : "bg-white/60"
            )}
          >
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {t.type === "appel" ? <Phone className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{t.titre}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className={cn("border", PRIORITE_COLORS[t.priorite] ?? "")}>
                  {t.priorite}
                </Badge>
                {t.cible_nom && (
                  <span className="text-muted-foreground">→ {t.cible_nom}</span>
                )}
                {t.compte_nom && (
                  <span className="text-muted-foreground/60">{t.compte_nom}</span>
                )}
                {t.due_date && (
                  <span className={cn(
                    overdue ? "font-medium text-red-600" : soon ? "font-medium text-orange-600" : "text-muted-foreground"
                  )}>
                    {overdue ? "En retard · " : ""}{fmtDate(t.due_date)}
                  </span>
                )}
              </div>
              {t.notes && (
                <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">{t.notes}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-muted-foreground"
                title="Supprimer"
                onClick={() => void remove(t.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 bg-emerald-600 text-white hover:bg-emerald-700"
                title="Marquer comme fait"
                onClick={() => void markDone(t.id)}
              >
                <CheckCircle2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
