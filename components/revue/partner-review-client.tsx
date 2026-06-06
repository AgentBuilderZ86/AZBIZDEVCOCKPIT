"use client";

import * as React from "react";
import { CheckCircle2, Copy, Printer, Target, TrendingUp, Users, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Compte, Opportunite, OppStage } from "@/lib/types";

interface Props {
  comptes: Compte[];
  opportunites: Opportunite[];
}

// ---- KPI computation ----
function computeKpis(comptes: Compte[], opportunites: Opportunite[]) {
  const totalPipeline = opportunites.reduce((s, o) => {
    if (o.stage === "Won" || o.stage === "Lost") return s;
    return s + (o.montant ?? 0) * ((o.probabilite ?? 0) / 100);
  }, 0);

  const totalWon = opportunites.filter(o => o.stage === "Won").reduce((s, o) => s + (o.montant ?? 0), 0);

  const byStage = (["Discovery","Qualified","Proposal","Negotiation"] as OppStage[]).map(stage => ({
    stage,
    count: opportunites.filter(o => o.stage === stage).length,
    montant: opportunites.filter(o => o.stage === stage).reduce((s, o) => s + (o.montant ?? 0), 0),
  }));

  const coreComptes = comptes.filter(c => c.categorie === "Core Advisory");
  const crossSellOpps = opportunites.filter(o => o.opportunite.startsWith("👥"));
  const crossSellPipeline = crossSellOpps.reduce((s, o) => {
    if (o.stage === "Won" || o.stage === "Lost") return s;
    return s + (o.montant ?? 0) * ((o.probabilite ?? 0) / 100);
  }, 0);

  const bigDeals = opportunites
    .filter(o => o.stage !== "Lost" && (o.montant ?? 0) >= 100)
    .sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0))
    .slice(0, 5);

  return { totalPipeline, totalWon, byStage, coreComptes, crossSellPipeline, crossSellOpps, bigDeals };
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  Discovery:   { label: "Discovery",   color: "bg-gray-100 text-gray-600" },
  Qualified:   { label: "Qualified",   color: "bg-blue-100 text-blue-700" },
  Proposal:    { label: "Proposal",    color: "bg-purple-100 text-purple-700" },
  Negotiation: { label: "Negotiation", color: "bg-orange-100 text-orange-700" },
  Won:         { label: "Won",         color: "bg-emerald-100 text-emerald-700" },
  Lost:        { label: "Lost",        color: "bg-red-100 text-red-600" },
};

export function PartnerReviewClient({ comptes, opportunites }: Props) {
  const [status, setStatus] = React.useState<"Brouillon" | "Finalisé">("Brouillon");
  const [notes, setNotes] = React.useState("");
  const kpis = React.useMemo(() => computeKpis(comptes, opportunites), [comptes, opportunites]);

  const today = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // ---- Copy to clipboard ----
  function handleCopy() {
    const lines: string[] = [
      `REVUE PLAN DE COMPTES — ${today.toUpperCase()}`,
      `Statut : ${status}`,
      "",
      "== PIPELINE ==",
      `• Pipeline pondéré total : ${kpis.totalPipeline.toFixed(0)}k€`,
      `• Revenue Won : ${kpis.totalWon.toFixed(0)}k€`,
      `• Cross-sell pipeline : ${kpis.crossSellPipeline.toFixed(0)}k€`,
      "",
      "== TOP DEALS ==",
      ...kpis.bigDeals.map(o => `• ${o.opportunite} — ${o.montant}k€ — ${o.stage}`),
      "",
      "== POINTS D'ESCALADE PARTNERS ==",
      "• BCP — AO AI Roadmap & Use Cases IA : 1 050k€ Proposal — Relance urgente, support TEC France requis",
      "• Cosumar — Multiple deals cross-sell en Proposal/Negotiation — Synergie cross-pratiques",
      "• OCP Group — OCP Organizing Framework : 200k€ Negotiation — Soutien engagement client",
      "",
      notes ? `== NOTES PRÉPARATION ==\n${notes}` : "",
    ];
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  }

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border bg-white/80 backdrop-blur-sm px-4 py-3" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Revue {today}</span>
          <button
            onClick={() => setStatus(s => s === "Brouillon" ? "Finalisé" : "Brouillon")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200",
              status === "Finalisé"
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            )}
          >
            {status === "Finalisé" && <CheckCircle2 className="h-3 w-3" />}
            {status}
          </button>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5" />
            Copier résumé
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Pipeline pondéré" value={`${kpis.totalPipeline.toFixed(0)}k€`} icon={TrendingUp} color="blue" />
        <KpiCard label="Revenue Won" value={`${kpis.totalWon.toFixed(0)}k€`} icon={CheckCircle2} color="emerald" />
        <KpiCard label="Pipeline Cross-sell" value={`${kpis.crossSellPipeline.toFixed(0)}k€`} icon={Users} color="violet" />
        <KpiCard label="Comptes Core" value={String(kpis.coreComptes.length)} icon={Target} color="orange" />
      </div>

      {/* Pipeline by stage */}
      <section className="rounded-xl border bg-white/80 backdrop-blur-sm p-5" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <h2 className="mb-4 text-sm font-bold tracking-tight">Pipeline par stage</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.byStage.map(({ stage, count, montant }) => (
            <div key={stage} className="rounded-lg border bg-muted/30 p-3">
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[stage]?.color)}>
                {stage}
              </span>
              <p className="mt-2 text-xl font-bold tracking-tight">{montant}k€</p>
              <p className="text-xs text-muted-foreground">{count} deal{count > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top deals — points d'escalade */}
      <section className="rounded-xl border bg-white/80 backdrop-blur-sm p-5" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-bold tracking-tight">Points d&apos;escalade Partners</h2>
          <span className="text-xs text-muted-foreground">(deals ≥ 100k€ où le support partner a du sens)</span>
        </div>
        <div className="space-y-2">
          {kpis.bigDeals.map((opp) => {
            return (
              <div key={opp.id} className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50/40 px-4 py-3">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{opp.opportunite}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[opp.stage ?? ""]?.color ?? "bg-muted text-muted-foreground")}>
                      {opp.stage}
                    </span>
                    <span className="text-sm font-bold text-foreground">{opp.montant}k€</span>
                  </div>
                  {opp.notes && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{opp.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Advisory accounts */}
      <section className="rounded-xl border bg-white/80 backdrop-blur-sm p-5" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-bold tracking-tight">Comptes Core Advisory</h2>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border">
          {kpis.coreComptes
            .sort((a, b) => (b.arrPondere ?? 0) - (a.arrPondere ?? 0))
            .slice(0, 10)
            .map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-primary/[0.02] transition-colors duration-150">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.compte}</p>
                  {c.notes && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.stage && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[c.stage]?.color ?? "bg-muted text-muted-foreground")}>
                      {c.stage}
                    </span>
                  )}
                  {c.arrPondere != null && c.arrPondere > 0 && (
                    <span className="text-sm font-bold tabular-nums">{c.arrPondere}k€</span>
                  )}
                </div>
              </div>
            ))}
          {kpis.coreComptes.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Aucun compte Core Advisory défini — catégorisez vos comptes dans le Plan de comptes.</p>
          )}
        </div>
      </section>

      {/* Cross-sell traction */}
      <section className="rounded-xl border bg-white/80 backdrop-blur-sm p-5" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold tracking-tight">Traction Cross-sell</h2>
          <span className="text-xs text-muted-foreground">{kpis.crossSellOpps.length} deals collègues — pipeline {kpis.crossSellPipeline.toFixed(0)}k€</span>
        </div>
        <div className="space-y-2">
          {(["Houda Al Alami", "Farah Rhouni", "Iliass Terchoune", "Ghita Arhmir"] as const).map((manager) => {
            const managerOpps = kpis.crossSellOpps.filter(o => o.opportunite.includes(manager));
            if (managerOpps.length === 0) return null;
            const pipeline = managerOpps.reduce((s, o) => {
              if (o.stage === "Lost") return s;
              return s + (o.montant ?? 0) * ((o.probabilite ?? 0) / 100);
            }, 0);
            return (
              <div key={manager} className="rounded-lg border bg-emerald-50/30 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{manager}</span>
                  <span className="text-xs font-semibold text-emerald-700">{pipeline.toFixed(0)}k€ pondéré</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{managerOpps.length} deal{managerOpps.length > 1 ? "s" : ""} — {managerOpps.map(o => o.stage).join(", ")}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preparation notes */}
      <section className="rounded-xl border bg-white/80 backdrop-blur-sm p-5 print:hidden" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
        <h2 className="mb-3 text-sm font-bold tracking-tight">Notes de préparation</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ajoutez vos notes avant la réunion — points à soulever, questions pour les partners, blocages à escalader…"
          rows={6}
          className="w-full resize-none rounded-lg border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-150"
        />
      </section>
    </div>
  );
}

// ---- KPI card sub-component ----
function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ComponentType<{className?: string}>; color: "blue" | "emerald" | "violet" | "orange" }) {
  const colorMap = {
    blue:    { bg: "bg-blue-50/60",    border: "border-blue-200/60",    icon: "text-blue-500",    value: "text-blue-900" },
    emerald: { bg: "bg-emerald-50/60", border: "border-emerald-200/60", icon: "text-emerald-500", value: "text-emerald-900" },
    violet:  { bg: "bg-violet-50/60",  border: "border-violet-200/60",  icon: "text-violet-500",  value: "text-violet-900" },
    orange:  { bg: "bg-orange-50/60",  border: "border-orange-200/60",  icon: "text-orange-500",  value: "text-orange-900" },
  }[color];
  return (
    <div className={cn("rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01]", colorMap.bg, colorMap.border)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-4 w-4", colorMap.icon)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", colorMap.value)}>{value}</p>
    </div>
  );
}
