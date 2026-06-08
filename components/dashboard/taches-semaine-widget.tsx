"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, Phone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TachesStats {
  enabled: boolean;
  weekCount: number;
  overdueCount: number;
  callCount: number;
  doneCount: number;
}

export function TachesSemaineWidget() {
  const [stats, setStats] = React.useState<TachesStats | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard/taches-semaine")
      .then((r) => r.json())
      .then((d) => setStats(d as TachesStats))
      .catch(() => {});
  }, []);

  if (!stats || !stats.enabled) return null;
  if (stats.weekCount === 0 && stats.doneCount === 0 && stats.overdueCount === 0) return null;

  return (
    <Link href="/semaine" className="block">
      <div
        className={cn(
          "bento-card cursor-pointer p-4 transition-all hover:scale-[1.01]",
          stats.overdueCount > 0 ? "border-red-300 bg-red-50/30" : ""
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                stats.overdueCount > 0 ? "bg-red-100" : "bg-primary/10"
              )}
            >
              <CalendarCheck
                className={cn("h-3.5 w-3.5", stats.overdueCount > 0 ? "text-red-600" : "text-primary")}
              />
            </span>
            <p className="text-sm font-semibold">Ma semaine</p>
          </div>
          {stats.overdueCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
              <AlertTriangle className="h-2.5 w-2.5" />
              {stats.overdueCount} en retard
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div>
            <p className="text-3xl font-bold tracking-tighter">{stats.weekCount}</p>
            <p className="text-xs text-muted-foreground">cette semaine</p>
          </div>
          {stats.callCount > 0 && (
            <div className="mb-1 flex items-center gap-1 text-sm font-medium text-primary">
              <Phone className="h-3.5 w-3.5" />
              {stats.callCount} appel{stats.callCount > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {stats.doneCount > 0 && (
          <p className="mt-1 text-[11px] text-emerald-600">{stats.doneCount} terminée(s)</p>
        )}
      </div>
    </Link>
  );
}
