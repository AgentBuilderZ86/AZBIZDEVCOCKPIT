"use client";

import { useEffect, useState } from "react";
import { parseApiJson } from "@/lib/parse-api-json";
import { Badge } from "@/components/ui/badge";
import type { OffreSynthesisPayload, CoverageIndicator } from "@/lib/types";

function coverageLabel(c: CoverageIndicator) {
  if (c === "rag_indexed") return { label: "RAG", className: "bg-green-50 text-green-700 border-green-200" };
  if (c === "expertise_sia") return { label: "Expertise", className: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Gap", className: "bg-red-50 text-red-700 border-red-200" };
}

export function OffreSynthesisWidget() {
  const [synthesis, setSynthesis] = useState<OffreSynthesisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/offre-synthesis")
      .then(parseApiJson)
      .then((data) => {
        if (data.synthesis) {
          setSynthesis(data.synthesis as OffreSynthesisPayload);
        } else {
          setEmpty(true);
        }
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (empty || !synthesis || synthesis.accountsCovered === 0) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Aucune analyse Offre générée. Sur chaque fiche compte, lancez{" "}
        <span className="font-medium text-foreground">« Offre Mapping & Plan d'Action »</span>{" "}
        pour alimenter cette vue.
      </div>
    );
  }

  const topicTiers = (freq: number, max: number) => {
    const ratio = max > 0 ? freq / max : 0;
    if (ratio > 0.6) return "text-base font-semibold";
    if (ratio > 0.3) return "text-sm font-medium";
    return "text-xs";
  };
  const maxFreq = synthesis.hotTopics[0]?.frequency ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white/70 p-3 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">Analyses générées</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground">{synthesis.accountsCovered}</p>
        </div>
        <div className="rounded-xl border bg-white/70 p-3 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">Topics RAG couverts</p>
          <p className="mt-0.5 text-2xl font-bold text-green-700">
            {synthesis.coverageSummary.rag_indexed}
          </p>
        </div>
        <div className="rounded-xl border bg-white/70 p-3 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">Gaps identifiés</p>
          <p className="mt-0.5 text-2xl font-bold text-red-600">
            {synthesis.coverageSummary.gap}
          </p>
        </div>
      </div>

      {/* Offres les plus demandées */}
      {synthesis.synthesisRows.length > 0 && (
        <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offres les plus demandées
          </p>
          <div className="space-y-2">
            {synthesis.synthesisRows.map((row) => {
              const cov = coverageLabel(row.dominantCoverage);
              return (
                <div
                  key={row.siaOffer}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="font-medium text-foreground min-w-0">{row.siaOffer}</span>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground">
                    {row.accountCount} compte{row.accountCount > 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className={`shrink-0 text-xs font-normal ${cov.className}`}>
                    {cov.label}
                  </Badge>
                  <div className="flex flex-wrap gap-1">
                    {row.topTopics.slice(0, 2).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Topics chauds */}
      {synthesis.hotTopics.length > 0 && (
        <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Topics chauds
          </p>
          <div className="flex flex-wrap gap-2">
            {synthesis.hotTopics.map(({ topic, frequency }) => (
              <span
                key={topic}
                className={`inline-flex items-center rounded-full border bg-muted/50 px-2.5 py-0.5 text-foreground ${topicTiers(frequency, maxFreq)}`}
                title={`${frequency} occurrence${frequency > 1 ? "s" : ""}`}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
