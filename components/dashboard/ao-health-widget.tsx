"use client";

import * as React from "react";
import Link from "next/link";
import { FileSearch, TrendingUp, AlertCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface AoStats {
  enabled: boolean;
  enCours: number;
  budgetTotal: number;
  urgentCount: number;
  goCount: number;
  wonCount: number;
}

export function AoHealthWidget() {
  const [stats, setStats] = React.useState<AoStats | null>(null);

  React.useEffect(() => {
    fetch("/api/dashboard/ao-health")
      .then((r) => r.json())
      .then((d) => setStats(d as AoStats))
      .catch(() => {});
  }, []);

  if (!stats || !stats.enabled) return null;

  return (
    <div className="bento-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <FileSearch className="h-3.5 w-3.5 text-primary" />
          </span>
          <p className="text-sm font-semibold">AO Pipeline</p>
        </div>
        <Link href="/ao" className="text-xs text-primary hover:underline">
          Voir tout →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-xs text-muted-foreground">En cours</p>
          <p className="mt-0.5 text-xl font-bold">{stats.enCours}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="text-xs text-muted-foreground">Budget total</p>
          <p className="mt-0.5 text-xl font-bold">
            {stats.budgetTotal > 0 ? `${Math.round(stats.budgetTotal).toLocaleString("fr")}` : "—"}
            {stats.budgetTotal > 0 && <span className="text-xs font-normal text-muted-foreground ml-0.5">k€</span>}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {stats.urgentCount > 0 && (
          <div className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium flex-1",
            "bg-red-50 text-red-700 border border-red-200"
          )}>
            <AlertCircle className="h-3 w-3 shrink-0" />
            {stats.urgentCount} deadline &lt;30j
          </div>
        )}
        {stats.goCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 flex-1">
            <TrendingUp className="h-3 w-3 shrink-0" />
            {stats.goCount} Go IA
          </div>
        )}
        {stats.wonCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 flex-1">
            <Trophy className="h-3 w-3 shrink-0" />
            {stats.wonCount} Won
          </div>
        )}
      </div>
    </div>
  );
}
