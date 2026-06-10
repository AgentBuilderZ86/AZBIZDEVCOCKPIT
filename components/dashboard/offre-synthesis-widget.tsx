"use client";

import { useEffect, useState } from "react";
import { parseApiJson } from "@/lib/parse-api-json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { OffreSynthesisPayload, CoverageIndicator } from "@/lib/types";
import { HotTopicsBubbles } from "@/components/dashboard/hot-topics-bubbles";

function coverageStyle(c: CoverageIndicator) {
  if (c === "rag_indexed") return { label: "RAG", className: "bg-green-50 text-green-700 border-green-200" };
  if (c === "expertise_sia") return { label: "Expertise", className: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Gap", className: "bg-red-50 text-red-700 border-red-200" };
}

export function OffreSynthesisWidget() {
  const [synthesis, setSynthesis] = useState<OffreSynthesisPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkPlan, setBulkPlan] = useState(true);
  const [bulkSignaux, setBulkSignaux] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ applied: number; skipped: number; total: number } | null>(null);

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

  async function handleBulkApply() {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await fetch("/api/intelligence/offre-mapping/bulk-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applyPlan: bulkPlan, applySignaux: bulkSignaux }),
      });
      const data = await parseApiJson(res);
      if (data.ok) {
        setBulkResult({
          applied: typeof data.applied === "number" ? data.applied : 0,
          skipped: typeof data.skipped === "number" ? data.skipped : 0,
          total: typeof data.total === "number" ? data.total : 0,
        });
      }
    } catch {
      // keep dialog open with no result
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <>
    <div className="bento-card overflow-hidden">
      {/* Horizontal 3-panel layout */}
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 divide-border/60">

        {/* Panel 1 — KPI metrics */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-4 sm:gap-6">
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
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 self-start"
            onClick={() => { setBulkResult(null); setShowBulk(true); }}
          >
            Appliquer tout à Notion
          </Button>
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

      </div>

      {/* Topics chauds — bulles pondérées */}
      <div className="border-t border-border/60 p-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="label-muted">Topics chauds</p>
          <p className="text-[11px] text-muted-foreground/70">Taille = récurrence · couleur = chaleur</p>
        </div>
        <HotTopicsBubbles topics={synthesis.hotTopics} />
      </div>
    </div>

    <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Appliquer les analyses à Notion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1 text-sm">
            <p className="text-muted-foreground text-xs">
              Applique les résultats d&apos;offre mapping de tous les comptes analysés ({synthesis.accountsCovered} comptes) vers Notion.
            </p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkPlan}
                onChange={(e) => setBulkPlan(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>Mettre à jour les plans stratégiques</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkSignaux}
                onChange={(e) => setBulkSignaux(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>Créer les signaux couverts <span className="text-muted-foreground">(offres non-Gap)</span></span>
            </label>
            {bulkResult && (
              <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs">
                <p className="font-semibold text-emerald-700">✓ Terminé</p>
                <p className="text-emerald-700/80">
                  {bulkResult.applied} comptes mis à jour · {bulkResult.skipped} échoués sur {bulkResult.total}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBulk(false)}>Annuler</Button>
            <Button
              size="sm"
              disabled={bulkLoading || (!bulkPlan && !bulkSignaux)}
              onClick={handleBulkApply}
            >
              {bulkLoading ? "Application…" : "Appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
