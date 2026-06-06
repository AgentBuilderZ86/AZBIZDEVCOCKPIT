"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sparkles, ChevronDown, ChevronUp, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseApiJson } from "@/lib/parse-api-json";
import type { OffreAnalysis, ActionStep, OffreMappingRow, CoverageIndicator } from "@/lib/types";

interface Props {
  compteId: string;
  intelligenceOn: boolean;
}

function coverageBadge(coverage: CoverageIndicator) {
  if (coverage === "rag_indexed") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-normal">
        ✅ RAG indexé
      </Badge>
    );
  }
  if (coverage === "expertise_sia") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-normal">
        🔵 Expertise Sia
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-normal">
      ⚠️ Gap
    </Badge>
  );
}

function horizonBadge(horizon: ActionStep["horizon"]) {
  if (horizon === "J+7") {
    return (
      <Badge variant="destructive" className="text-xs font-normal shrink-0">
        {horizon}
      </Badge>
    );
  }
  if (horizon === "J+30") {
    return (
      <Badge className="text-xs font-normal shrink-0">
        {horizon}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs font-normal shrink-0">
      {horizon}
    </Badge>
  );
}

function ApplyDialog({
  open,
  onClose,
  onConfirm,
  analysis,
  hasExistingPlan,
  applying,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (opts: { applyPlan: boolean; applySignaux: boolean }) => void;
  analysis: OffreAnalysis;
  hasExistingPlan: boolean;
  applying: boolean;
}) {
  const [applyPlan, setApplyPlan] = useState(true);
  const [applySignaux, setApplySignaux] = useState(false);

  const ragCoveredCount = analysis.mappingRows.filter(
    (m) => m.coverage !== "gap"
  ).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Appliquer au Plan Notion</DialogTitle>
          <DialogDescription>
            Sélectionnez ce que vous souhaitez écrire dans Notion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/50">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={applyPlan}
              onChange={(e) => setApplyPlan(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium">Mettre à jour le plan stratégique</p>
              <p className="text-xs text-muted-foreground">
                Synthèse + mapping offres + plan d'action → champ "Plan stratégique compte"
              </p>
              {hasExistingPlan && (
                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" />
                  Le plan existant sera remplacé.
                </p>
              )}
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer rounded-md border p-3 hover:bg-muted/50">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={applySignaux}
              onChange={(e) => setApplySignaux(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium">
                Créer des signaux Notion ({ragCoveredCount} topics couverts)
              </p>
              <p className="text-xs text-muted-foreground">
                Ajoute 1 signal par offre Sia couverte (RAG ou expertise), statut "À exploiter".
              </p>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={applying}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm({ applyPlan, applySignaux })}
            disabled={applying || (!applyPlan && !applySignaux)}
          >
            {applying ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OffreMappingPanel({ compteId, intelligenceOn }: Props) {
  const [analysis, setAnalysis] = useState<OffreAnalysis | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "generating" | "done" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/compte/${compteId}/offre-analysis`);
      if (res.status === 404) {
        setStatus("idle");
        return;
      }
      const data = await parseApiJson(res);
      if (data.error) {
        setStatus("error");
        setErrorMsg(typeof data.error === "string" ? data.error : "Erreur.");
        return;
      }
      setAnalysis(data.analysis as OffreAnalysis);
      setStatus("done");
    } catch {
      // Timeout ou HTML Netlify → traiter comme "pas d'analyse" plutôt qu'erreur bloquante
      setStatus("idle");
    }
  }, [compteId]);

  useEffect(() => {
    if (intelligenceOn) void load();
  }, [intelligenceOn, load]);

  const generate = useCallback(async () => {
    setStatus("generating");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/compte/${compteId}/offre-analysis`, {
        method: "POST",
      });
      const data = await parseApiJson(res);
      if (data.error) {
        setStatus("error");
        setErrorMsg(typeof data.error === "string" ? data.error : "Erreur génération.");
        toast.error(typeof data.error === "string" ? data.error : "Erreur génération.");
        return;
      }
      setAnalysis(data.analysis as OffreAnalysis);
      setStatus("done");
      toast.success("Analyse offre générée.");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur réseau.");
      toast.error("Erreur lors de la génération.");
    }
  }, [compteId]);

  const handleApply = useCallback(
    async (opts: { applyPlan: boolean; applySignaux: boolean }) => {
      setApplying(true);
      try {
        const res = await fetch(`/api/compte/${compteId}/offre-analysis/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });
        const data = await parseApiJson(res);
        if (data.error) {
          toast.error(typeof data.error === "string" ? data.error : "Erreur.");
        } else {
          const parts: string[] = [];
          if (data.planApplied) parts.push("plan stratégique mis à jour");
          if (typeof data.signauxCreated === "number" && data.signauxCreated > 0)
            parts.push(`${data.signauxCreated} signal(s) créé(s)`);
          toast.success(parts.length ? `Notion : ${parts.join(", ")}.` : "Notion mis à jour.");
          setApplyDialogOpen(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur réseau.");
      } finally {
        setApplying(false);
      }
    },
    [compteId]
  );

  if (!intelligenceOn) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Offre Mapping indisponible — configurez DATABASE_URL et migrez Postgres.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-medium">Erreur lors du chargement de l'analyse.</p>
        {errorMsg && <p className="mt-1 font-mono text-xs opacity-80">{errorMsg}</p>}
        <Button variant="outline" size="sm" className="mt-2" onClick={load}>
          Réessayer
        </Button>
      </div>
    );
  }

  if (status === "idle" && !analysis) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-center">
        <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Mapping Offres & Plan d'Action
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Identifiez les offres Sia prioritaires et votre plan d'action personnalisé.
        </p>
        <Button size="sm" className="mt-3" onClick={generate}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Générer l'analyse (Claude Opus)
        </Button>
      </div>
    );
  }

  if (status === "generating") {
    return (
      <div className="rounded-lg border p-5 text-center">
        <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Analyse en cours (Claude Opus, ~30s)…
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              Mapping Offres & Plan d'Action
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={generate}
                title="Regénérer l'analyse"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {analysis.generatedAt && (
            <p className="text-xs text-muted-foreground">
              Généré le {new Date(analysis.generatedAt).toLocaleDateString("fr-FR")}
            </p>
          )}
        </CardHeader>

        {!collapsed && (
          <CardContent className="space-y-5">
            {/* Synthèse narrative */}
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-sm italic text-foreground leading-relaxed">
                {analysis.syntheseNarrative}
              </p>
            </div>

            {/* Mapping table */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mapping sujet → offre Sia
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-1.5 pr-3 text-left font-medium">Sujet prioritaire</th>
                      <th className="pb-1.5 pr-3 text-left font-medium">Offre Sia</th>
                      <th className="pb-1.5 pr-3 text-left font-medium">Couverture</th>
                      <th className="pb-1.5 text-left font-medium">Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analysis.mappingRows.map((row: OffreMappingRow, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-2 pr-3 font-medium text-foreground">{row.topic}</td>
                        <td className="py-2 pr-3 text-foreground">{row.siaOffer}</td>
                        <td className="py-2 pr-3">{coverageBadge(row.coverage)}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {row.rationale}
                          {row.ragDocTitles.length > 0 && (
                            <span className="mt-0.5 block text-green-700">
                              ↳ {row.ragDocTitles.slice(0, 2).join(", ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Plan d'action */}
            {analysis.actionSteps.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan d'action personnel
                </h3>
                <ol className="space-y-2">
                  {analysis.actionSteps.map((step: ActionStep) => (
                    <li
                      key={step.order}
                      className="flex items-start gap-2.5 rounded-md border bg-muted/20 px-3 py-2"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {step.order}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {horizonBadge(step.horizon)}
                          {step.linkedOffer && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {step.linkedOffer}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{step.action}</p>
                        {step.targetContacts.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            👤 {step.targetContacts.join(", ")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Apply to Notion */}
            <div className="flex justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setApplyDialogOpen(true)}
              >
                <Send className="h-3.5 w-3.5" />
                Appliquer au Plan Notion
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <ApplyDialog
        open={applyDialogOpen}
        onClose={() => setApplyDialogOpen(false)}
        onConfirm={handleApply}
        analysis={analysis}
        hasExistingPlan={false}
        applying={applying}
      />
    </>
  );
}
