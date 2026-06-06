"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionStats {
  enabled: boolean;
  pendingCount: number;
  j7Count: number;
  doneCount: number;
}

export function ActionsUrgentesWidget() {
  const [stats, setStats] = React.useState<ActionStats | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard/actions-urgentes")
      .then((r) => r.json())
      .then((d) => setStats(d as ActionStats))
      .catch(() => {});
  }, []);

  if (!stats || !stats.enabled || (stats.pendingCount === 0 && stats.doneCount === 0)) return null;

  const completionRate = stats.pendingCount + stats.doneCount > 0
    ? Math.round((stats.doneCount / (stats.pendingCount + stats.doneCount)) * 100)
    : 0;

  return (
    <Link href="/revue-actions" className="block">
      <div className={cn(
        "bento-card p-4 transition-all hover:scale-[1.01] cursor-pointer",
        stats.j7Count > 0 ? "border-amber-300 bg-amber-50/30" : ""
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md",
              stats.j7Count > 0 ? "bg-amber-100" : "bg-primary/10"
            )}>
              <ClipboardCheck className={cn("h-3.5 w-3.5", stats.j7Count > 0 ? "text-amber-600" : "text-primary")} />
            </span>
            <p className="text-sm font-semibold">Actions en attente</p>
          </div>
          {stats.j7Count > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
              <Zap className="h-2.5 w-2.5" />
              {stats.j7Count} J+7
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tighter">{stats.pendingCount}</p>
            <p className="text-xs text-muted-foreground">en attente</p>
          </div>
          {stats.doneCount > 0 && (
            <div className="mb-1">
              <p className="text-sm font-medium text-emerald-600">{stats.doneCount} effectuées</p>
            </div>
          )}
        </div>

        {completionRate > 0 && (
          <div className="mt-2">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{completionRate}% complété</p>
          </div>
        )}
      </div>
    </Link>
  );
}
