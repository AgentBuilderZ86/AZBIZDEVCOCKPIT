"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseApiJson } from "@/lib/parse-api-json";

interface BreakdownRow {
  label: string;
  value: number;
  max: number;
}

interface ScoreLatest {
  score: number;
  scoredAt: string;
  breakdown: BreakdownRow[];
  heuristic: number;
  blended: number;
  learnedDelta: number;
  modelMode: string;
  sampleWon: number;
  sampleLost: number;
}

interface HistoryPoint {
  score: number;
  scoredAt: string;
}

interface Props {
  compteId: string;
  enabled: boolean;
}

function modelBadge(mode: string, sampleWon: number, sampleLost: number) {
  if (mode === "logistic_v1") {
    return { label: `Logistic ML (${sampleWon}W/${sampleLost}L)`, className: "bg-violet-100 text-violet-800" };
  }
  if (mode === "learned_v1" && (sampleWon >= 2 || sampleLost >= 2)) {
    return { label: `Scalar ML (${sampleWon}W/${sampleLost}L)`, className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Heuristique", className: "bg-slate-100 text-slate-700" };
}

export function ScorePanel({ compteId, enabled }: Props) {
  const [latest, setLatest] = React.useState<ScoreLatest | null>(null);
  const [history, setHistory] = React.useState<HistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    fetch(`/api/compte/${compteId}/score-history`)
      .then((r) => parseApiJson(r))
      .then((data) => {
        setLatest((data.latest as ScoreLatest) ?? null);
        setHistory((data.history as HistoryPoint[]) ?? []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [compteId, enabled]);

  if (!enabled) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4">
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!latest) return null;

  const badge = modelBadge(latest.modelMode, latest.sampleWon, latest.sampleLost);
  const sparkMin = Math.min(...history.map((h) => h.score), 0);
  const sparkMax = Math.max(...history.map((h) => h.score), 1);
  const sparkRange = sparkMax - sparkMin || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Score AdilStar
          </span>
          <Badge className={badge.className}>{badge.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score + delta */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{latest.score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
          {latest.learnedDelta !== 0 && (
            <span className={`text-xs font-medium ${latest.learnedDelta > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {latest.learnedDelta > 0 ? `+${latest.learnedDelta}` : latest.learnedDelta} ML
            </span>
          )}
        </div>

        {/* Sparkline */}
        {history.length > 1 && (
          <div className="flex h-8 items-end gap-px overflow-hidden rounded">
            {[...history].reverse().map((h, i) => {
              const pct = ((h.score - sparkMin) / sparkRange) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(10, pct)}%` }}
                  title={`${h.score} pts`}
                />
              );
            })}
          </div>
        )}

        {/* Breakdown */}
        <div className="space-y-1.5">
          {latest.breakdown.map((row) => (
            <div key={row.label}>
              <div className="mb-0.5 flex justify-between text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className={row.value < 0 ? "text-red-500" : "font-medium"}>
                  {row.value > 0 ? `+${row.value}` : row.value}
                </span>
              </div>
              {row.value >= 0 && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Dernier calcul : {new Date(latest.scoredAt).toLocaleDateString("fr-FR")}
        </p>
      </CardContent>
    </Card>
  );
}
