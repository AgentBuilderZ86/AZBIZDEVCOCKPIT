"use client";

import { useEffect, useState } from "react";
import { parseApiJson } from "@/lib/parse-api-json";
import { Badge } from "@/components/ui/badge";
import type { OffreSynthesisPayload, CoverageIndicator } from "@/lib/types";

function coverageStyle(c: CoverageIndicator) {
  if (c === "rag_indexed") return { label: "RAG", className: "bg-green-50 text-green-700 border-green-200" };
  if (c === "expertise_sia") return { label: "Expertise", className: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Gap", className: "bg-red-50 text-red-700 border-red-200" };
}

function topicWeight(freq: number, max: number) {
  const r = max > 0 ? freq / max : 0;
  if (r > 0.65) return "text-sm font-semibold text-foreground";
  if (r > 0.35) return "text-xs font-medium text-foreground/80";
  return "text-xs text-muted-foreground";
}

export function OffreSynthesisWidget() {
  const [synthesis, setSynthesis] = useState<OffreSynthesisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/offre-synthesis")
      .then(parseApiJson)
      .then((data) => {
        if (data.synthesis) setSynthesis(data.synthesis as OffreSynthesisPayload);
        else setEmpty(true);
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bento-card p-4">
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 flex-1 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (empty || !synthesis || synthesis.accountsCovered === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Aucune analyse Offre générée. Sur chaque fiche compte, lancez{" "}
        <span className="font-medium text-foreground">Offre Mapping & Plan d'Action</span>{" "}
        pour alimenter cette vue.
      </div>
    );
  }

  const maxFreq = synthesis.hotTopics[0]?.frequency ?? 1;

  return (
    <div className="bento-card overflow-hidden">
      {/* Horizontal 3-panel layout */}
      <div className="grid grid-cols-1 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-border/60">

        {/* Panel 1 — KPI metrics */}
        <div className="flex items-center gap-4 p-4 sm:gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">{synthesis.accountsCovered}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Analyses</p>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="text-center">
            <p className="text-2xl font-bold text-green-700 tabular-nums">
              {synthesis.coverageSummary.rag_indexed}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">RAG couverts</p>
          </div>
          <div className="h-8 w-px bg-border/60" />
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 tabular-nums">
              {synthesis.coverageSummary.gap}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Gaps</p>
          </div>
        </div>

        {/* Panel 2 — Top offres */}
        <div className="p-4">
          <p className="mb-2 label-muted">Offres demandées</p>
          <div className="space-y-1.5">
            {synthesis.synthesisRows.slice(0, 4).map((row) => {
              const cov = coverageStyle(row.dominantCoverage);
              return (
                <div key={row.siaOffer} className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-xs font-medium text-foreground min-w-0 flex-1">
                    {row.siaOffer}
                  </span>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground py-0 px-1.5">
                    {row.accountCount}
                  </Badge>
                  <Badge variant="outline" className={`shrink-0 text-xs font-normal py-0 px-1.5 ${cov.className}`}>
                    {cov.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 3 — Topics chauds (tag cloud) */}
        <div className="p-4">
          <p className="mb-2 label-muted">Topics chauds</p>
          <div className="flex flex-wrap gap-1.5">
            {synthesis.hotTopics.slice(0, 12).map(({ topic, frequency }) => (
              <span
                key={topic}
                title={`${frequency} occurrence${frequency > 1 ? "s" : ""}`}
                className={`inline-flex items-center rounded-full border bg-muted/40 px-2 py-0.5 transition-colors hover:bg-primary/10 hover:border-primary/20 cursor-default ${topicWeight(frequency, maxFreq)}`}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
