"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Flame, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DormantAccount {
  id: string;
  name: string;
  daysSinceLastInteraction: number;
}

interface EffortStats {
  enabled: boolean;
  weeklyCount: number;
  weeklyTarget: number;
  weeklyStreak: number;
  monthlyCount: number;
  monthlyPrevious: number;
  coveragePercent: number;
  dormantAccounts: DormantAccount[];
}

function getWeekNumber(): number {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7
  );
}

export function GamificationSection({
  intelligenceOn,
}: {
  intelligenceOn: boolean;
}) {
  const [stats, setStats] = useState<EffortStats | null>(null);
  const [animPct, setAnimPct] = useState(0);

  useEffect(() => {
    if (!intelligenceOn) return;
    fetch("/api/dashboard/effort-stats")
      .then((r) => r.json())
      .then((data: EffortStats) => {
        setStats(data);
        setTimeout(() => {
          setAnimPct(
            Math.min(
              100,
              Math.round((data.weeklyCount / (data.weeklyTarget || 1)) * 100)
            )
          );
        }, 150);
      })
      .catch(() => {});
  }, [intelligenceOn]);

  if (!intelligenceOn) {
    return (
      <div className="bento-card p-5 flex items-center gap-3 text-muted-foreground h-full">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Suivi de cadence</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Activez Intelligence pour suivre vos interactions commerciales.
          </p>
        </div>
      </div>
    );
  }

  // Skeleton
  if (!stats) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 h-full">
        <div className="bento-card p-5 space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
        <div className="bento-card p-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const pct = Math.min(
    100,
    Math.round((stats.weeklyCount / (stats.weeklyTarget || 1)) * 100)
  );
  const isGood = pct >= 80;
  const isOk = pct >= 50;

  const gradientClass = isGood
    ? "from-emerald-50/70 to-green-50/40 border-emerald-200/60"
    : isOk
      ? "from-amber-50/70 to-orange-50/40 border-amber-200/60"
      : "from-red-50/50 to-rose-50/30 border-red-200/50";

  const barClass = isGood
    ? "bg-emerald-500"
    : isOk
      ? "bg-amber-500"
      : "bg-red-500";

  const pctTextClass = isGood
    ? "text-emerald-700"
    : isOk
      ? "text-amber-700"
      : "text-red-700";

  const weekNumber = getWeekNumber();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Cadence card */}
      <div
        className={cn(
          "bento-card p-5 bg-gradient-to-br",
          gradientClass
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground/60" />
            <p className="label-muted">Cadence commerciale</p>
          </div>
          <span className="text-xs text-muted-foreground/60">Sem. {weekNumber}</span>
        </div>

        <div className="mt-4 flex items-end gap-1.5">
          <span className="text-3xl font-bold tracking-tighter">
            {stats.weeklyCount}
          </span>
          <span className="mb-0.5 text-sm text-muted-foreground">
            / {stats.weeklyTarget} interactions
          </span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.07]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              barClass
            )}
            style={{ width: `${animPct}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className={cn("text-sm font-semibold", pctTextClass)}>
            {pct}% de l&apos;objectif
          </span>
          {stats.weeklyStreak > 0 && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                stats.weeklyStreak >= 3
                  ? "text-orange-600"
                  : "text-muted-foreground"
              )}
            >
              <Flame
                className={cn(
                  "h-3.5 w-3.5",
                  stats.weeklyStreak >= 3 && "animate-pulse"
                )}
              />
              {stats.weeklyStreak} sem.
            </span>
          )}
        </div>

        <div className="mt-4 flex gap-4 border-t border-black/[0.06] pt-3">
          <div>
            <p className="label-muted" style={{ fontSize: "0.6rem" }}>Ce mois</p>
            <p className="mt-0.5 text-base font-bold">{stats.monthlyCount}</p>
          </div>
          {stats.monthlyPrevious > 0 && (
            <div>
              <p className="label-muted" style={{ fontSize: "0.6rem" }}>Mois préc.</p>
              <p className="mt-0.5 text-base font-bold text-muted-foreground">
                {stats.monthlyPrevious}
              </p>
            </div>
          )}
          <div>
            <p className="label-muted" style={{ fontSize: "0.6rem" }}>Couverture</p>
            <p className="mt-0.5 text-base font-bold">{stats.coveragePercent}%</p>
          </div>
        </div>
      </div>

      {/* Dormants card */}
      {stats.dormantAccounts.length === 0 ? (
        <div className="bento-card p-5 flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
            <span className="text-base">✓</span>
          </div>
          <p className="text-sm font-semibold text-emerald-700">
            Aucun compte dormant
          </p>
          <p className="text-xs text-muted-foreground/70">
            Tous vos comptes actifs ont été contactés récemment.
          </p>
        </div>
      ) : (
        <div className="bento-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <p className="label-muted">À relancer</p>
          </div>
          <ul className="space-y-1">
            {stats.dormantAccounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/compte/${a.id}`}
                  className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm hover:bg-red-50/60 transition-colors duration-150 group"
                >
                  <span className="truncate font-medium group-hover:text-primary transition-colors duration-150">
                    {a.name}
                  </span>
                  <span
                    className={cn(
                      "ml-2 shrink-0 text-xs font-semibold",
                      a.daysSinceLastInteraction > 21
                        ? "text-red-600"
                        : "text-amber-600"
                    )}
                  >
                    {a.daysSinceLastInteraction >= 999
                      ? "jamais"
                      : `${a.daysSinceLastInteraction}j`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
