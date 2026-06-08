"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TachesList } from "@/components/taches/taches-list";
import { cn } from "@/lib/utils";
import { parseApiJson } from "@/lib/parse-api-json";
import type { TacheRow } from "@/lib/types";

/** Forme SQL renvoyée par /api/revue-actions (snake_case). */
interface RevueActionRow {
  id: string;
  compte_nom: string;
  action_text: string;
  horizon: string;
}

const HORIZON_COLORS: Record<string, string> = {
  "J+7": "bg-red-100 text-red-700 border-red-200",
  "J+30": "bg-amber-100 text-amber-700 border-amber-200",
  "J+90": "bg-blue-100 text-blue-700 border-blue-200",
  "J+180": "bg-slate-100 text-slate-600 border-slate-200",
};

type Filter = "all" | "todo" | "appel";

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function endOfWeek(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // lundi=0
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}

export function SemaineClient() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [taches, setTaches] = React.useState<TacheRow[]>([]);
  const [actions, setActions] = React.useState<RevueActionRow[]>([]);
  const [filter, setFilter] = React.useState<Filter>("all");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [tRes, aRes] = await Promise.all([
          fetch("/api/taches?range=week&status=pending"),
          fetch("/api/revue-actions?status=pending"),
        ]);
        const tData = await parseApiJson(tRes);
        const aData = await parseApiJson(aRes);
        if (cancelled) return;
        setTaches((tData.taches as TacheRow[]) ?? []);
        // /api/revue-actions renvoie des lignes snake_case
        setActions((aData.actions as RevueActionRow[]) ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erreur de chargement.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = taches.filter((t) => filter === "all" || t.type === filter);
  const eow = endOfWeek().getTime();

  const overdue = filtered.filter((t) => t.due_date && daysUntil(t.due_date) < 0);
  const thisWeek = filtered.filter(
    (t) => t.due_date && daysUntil(t.due_date) >= 0 && new Date(t.due_date).getTime() <= eow
  );
  const later = filtered.filter((t) => t.due_date && new Date(t.due_date).getTime() > eow);
  const noDate = filtered.filter((t) => !t.due_date);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="flex gap-1.5">
        {(["all", "todo", "appel"] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            className="h-8"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tout" : f === "todo" ? "Tâches" : "Appels"}
          </Button>
        ))}
      </div>

      <Bucket title="En retard" count={overdue.length} tone="danger">
        <TachesList taches={overdue} emptyLabel="Rien en retard. 👍" />
      </Bucket>

      <Bucket title="Cette semaine" count={thisWeek.length}>
        <TachesList taches={thisWeek} emptyLabel="Aucune échéance cette semaine." />
      </Bucket>

      {noDate.length > 0 && (
        <Bucket title="Sans échéance" count={noDate.length}>
          <TachesList taches={noDate} />
        </Bucket>
      )}

      {later.length > 0 && (
        <Bucket title="À venir" count={later.length}>
          <TachesList taches={later} />
        </Bucket>
      )}

      {/* Actions IA recommandées (lecture seule) */}
      {actions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Recommandations IA en attente</h2>
            <Badge variant="outline">{actions.length}</Badge>
            <Link href="/revue-actions" className="ml-auto text-xs text-primary hover:underline">
              Ouvrir la revue →
            </Link>
          </div>
          <div className="space-y-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border bg-primary/5 px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn("mt-0.5 shrink-0 border text-[11px]", HORIZON_COLORS[a.horizon] ?? "")}
                >
                  {a.horizon}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{a.action_text}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.compte_nom}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Bucket({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className={cn(
          "mb-2 flex items-center gap-2 text-sm font-semibold",
          tone === "danger" && count > 0 ? "text-red-600" : ""
        )}
      >
        {title}
        <Badge variant="outline" className={tone === "danger" && count > 0 ? "border-red-200 text-red-600" : ""}>
          {count}
        </Badge>
      </h2>
      {children}
    </div>
  );
}
