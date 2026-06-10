"use client";

import * as React from "react";
import {
  CheckCircle2, Copy, Printer, Target, TrendingUp,
  Users, AlertCircle, ChevronRight, User, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Compte, Opportunite, OppStage } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type ViewMode = "moi" | "cabinet" | "mixte";

interface Props {
  comptes: Compte[];
  opportunites: Opportunite[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const COLLEAGUE_NAMES = [
  "Houda Al Alami", "Farah Rhouni", "Iliass Terchoune",
  "Ghita Arhmir", "Mohamed Drouach",
];

/**
 * Deal Adil = aucun indicateur collègue dans le titre.
 * On cherche l'emoji 👥 N'IMPORTE OÙ dans la chaîne
 * (certains deals ont "Titre 👥 Manager" au lieu de "👥 Manager — Titre")
 * et on vérifie aussi la présence du nom du manager.
 */
function isAdilOpp(o: Opportunite) {
  const t = o.opportunite;
  if (t.includes("👥")) return false;
  if (COLLEAGUE_NAMES.some(n => t.includes(n))) return false;
  return true;
}

function filterOpps(opps: Opportunite[], view: ViewMode): Opportunite[] {
  if (view === "moi") return opps.filter(isAdilOpp);
  return opps; // cabinet + mixte = tout
}

function computeKpis(opps: Opportunite[]) {
  const pipeline = opps.reduce((s, o) => {
    if (o.stage === "Won" || o.stage === "Lost") return s;
    return s + (o.montant ?? 0) * ((o.probabilite ?? 0) / 100);
  }, 0);
  const won = opps.filter(o => o.stage === "Won").reduce((s, o) => s + (o.montant ?? 0), 0);
  const byStage = (["Discovery", "Qualified", "Proposal", "Negotiation"] as OppStage[]).map(stage => ({
    stage,
    count: opps.filter(o => o.stage === stage).length,
    montant: opps.filter(o => o.stage === stage).reduce((s, o) => s + (o.montant ?? 0), 0),
  }));
  const bigDeals = opps
    .filter(o => o.stage !== "Lost" && (o.montant ?? 0) >= 100)
    .sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0))
    .slice(0, 6);
  return { pipeline, won, byStage, bigDeals };
}

const STAGE_CONFIG: Record<string, string> = {
  Discovery:   "bg-gray-100 text-gray-600",
  Qualified:   "bg-blue-100 text-blue-700",
  Proposal:    "bg-purple-100 text-purple-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Won:         "bg-emerald-100 text-emerald-700",
  Lost:        "bg-red-100 text-red-600",
};

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

type PanelKey = "won" | "pipeline" | "active" | "core" | null;

export function PartnerReviewClient({ comptes, opportunites }: Props) {
  const [view, setView] = React.useState<ViewMode>("moi");
  const [status, setStatus] = React.useState<"Brouillon" | "Finalisé">("Brouillon");
  const [notes, setNotes] = React.useState("");
  const [openPanel, setOpenPanel] = React.useState<PanelKey>(null);

  function togglePanel(key: PanelKey) {
    setOpenPanel(v => v === key ? null : key);
  }

  // Keep legacy alias used below
  const showWon = openPanel === "won";

  const today = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const activeOpps = React.useMemo(() => filterOpps(opportunites, view), [opportunites, view]);
  const kpis       = React.useMemo(() => computeKpis(activeOpps), [activeOpps]);

  /* Pour vue mixte */
  const adilOpps     = React.useMemo(() => opportunites.filter(isAdilOpp), [opportunites]);
  const colleagueOpps = React.useMemo(() => opportunites.filter(o => !isAdilOpp(o)), [opportunites]);
  const kpisAdil     = React.useMemo(() => computeKpis(adilOpps), [adilOpps]);
  const kpisCab      = React.useMemo(() => computeKpis(colleagueOpps), [colleagueOpps]);

  const coreComptes = React.useMemo(
    () => comptes.filter(c => c.categorie === "Core Advisory").sort((a, b) => (b.arrPondere ?? 0) - (a.arrPondere ?? 0)),
    [comptes]
  );

  const crossSellOpps = React.useMemo(
    () => opportunites.filter(o => o.opportunite.startsWith("👥")),
    [opportunites]
  );

  /* ---- Copy ---- */
  function handleCopy() {
    const viewLabel = view === "moi" ? "Moi — TEC/CIO" : view === "cabinet" ? "Cabinet complet" : "Vue mixte";
    const lines = [
      `REVUE PLAN DE COMPTES — ${today.toUpperCase()} — ${viewLabel}`,
      `Statut : ${status}`,
      "",
      "== PIPELINE ==",
      `• Pipeline pondéré : ${kpis.pipeline.toFixed(0)}k€`,
      `• Revenue Won : ${kpis.won.toFixed(0)}k€`,
      view === "mixte" ? `• Adil seul : ${kpisAdil.pipeline.toFixed(0)}k€ pipeline / ${kpisAdil.won.toFixed(0)}k€ Won` : "",
      view === "mixte" ? `• Collègues : ${kpisCab.pipeline.toFixed(0)}k€ pipeline / ${kpisCab.won.toFixed(0)}k€ Won` : "",
      "",
      "== TOP DEALS ==",
      ...kpis.bigDeals.map(o => `• ${o.opportunite} — ${o.montant}k€ — ${o.stage}`),
      "",
      notes ? `== NOTES ==\n${notes}` : "",
    ];
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
  }

  return (
    <div className="space-y-6 print:space-y-4">

      {/* ---- Vue switcher ---- */}
      <div className="bento-card p-1.5 flex gap-1">
        {([
          { id: "moi",     icon: User,      label: "Moi — TEC/CIO",   sub: "Mes deals directs" },
          { id: "cabinet", icon: Building2, label: "Cabinet complet", sub: "Tous les deals" },
          { id: "mixte",   icon: Users,     label: "Vue mixte",       sub: "Adil vs Collègues" },
        ] as const).map(({ id, icon: Icon, label, sub }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex-1 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150",
              view === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted/60 text-muted-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", view === id ? "text-primary-foreground" : "text-muted-foreground")} />
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold leading-tight", view === id ? "text-primary-foreground" : "text-foreground")}>{label}</p>
              <p className={cn("text-[10px] leading-tight", view === id ? "text-primary-foreground/70" : "text-muted-foreground")}>{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ---- Status / actions bar ---- */}
      <div className="flex items-center justify-between gap-4 bento-card px-4 py-3">
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

      {/* ---- KPIs ---- */}
      {view !== "mixte" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Pipeline pondéré" value={`${kpis.pipeline.toFixed(0)}k€`} icon={TrendingUp} color="blue"
            sub={`${activeOpps.filter(o => o.stage !== "Won" && o.stage !== "Lost").length} deals · cliquer pour voir`}
            onClick={() => togglePanel("pipeline")} active={openPanel === "pipeline"} />
          <KpiCard label="Revenue Won" value={`${kpis.won.toFixed(0)}k€`} icon={CheckCircle2} color="emerald"
            sub={`${activeOpps.filter(o => o.stage === "Won").length} deals · cliquer pour voir`}
            onClick={() => togglePanel("won")} active={openPanel === "won"} />
          <KpiCard label="Deals actifs" value={String(activeOpps.filter(o => o.stage !== "Won" && o.stage !== "Lost").length)}
            icon={Users} color="violet"
            sub={`${activeOpps.filter(o => o.stage === "Won").length} Won · ${activeOpps.filter(o => o.stage === "Lost").length} Lost · cliquer`}
            onClick={() => togglePanel("active")} active={openPanel === "active"} />
          <KpiCard label="Comptes Core" value={String(coreComptes.length)} icon={Target} color="orange"
            sub="CIO / Data / IA · cliquer pour voir"
            onClick={() => togglePanel("core")} active={openPanel === "core"} />
        </div>
      ) : (
        /* ---- Vue mixte : side-by-side ---- */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MixtePanel
            label="🎯 Adil — TEC/CIO"
            color="blue"
            pipeline={kpisAdil.pipeline}
            won={kpisAdil.won}
            deals={adilOpps}
          />
          <MixtePanel
            label="🤝 Collègues — Cross-sell"
            color="emerald"
            pipeline={kpisCab.pipeline}
            won={kpisCab.won}
            deals={colleagueOpps}
          />
        </div>
      )}

      {/* ---- Panneaux dépliables KPI ---- */}
      {openPanel !== null && view !== "mixte" && (
        <ExpandedPanel
          panelKey={openPanel}
          activeOpps={activeOpps}
          coreComptes={coreComptes}
          kpis={kpis}
          onClose={() => setOpenPanel(null)}
        />
      )}

      {/* ---- Pipeline par stage ---- */}
      <section className="bento-card p-5">
        <h2 className="mb-4 text-sm font-bold tracking-tight">
          Pipeline par stage
          {view === "mixte" && <span className="ml-2 text-xs font-normal text-muted-foreground">— cabinet complet</span>}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(view === "mixte" ? computeKpis(opportunites) : kpis).byStage.map(({ stage, count, montant }) => (
            <div key={stage} className="rounded-lg border bg-muted/30 p-3">
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[stage])}>
                {stage}
              </span>
              <p className="mt-2 text-xl font-bold tracking-tight">{montant}k€</p>
              <p className="text-xs text-muted-foreground">{count} deal{count > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Points d'escalade ---- */}
      <section className="bento-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-bold tracking-tight">Points d&apos;escalade Partners</h2>
          <span className="text-xs text-muted-foreground">(deals ≥ 100k€)</span>
        </div>
        <div className="space-y-2">
          {kpis.bigDeals.map((opp) => (
            <div key={opp.id} className="flex items-start gap-3 rounded-lg border border-orange-100 bg-orange-50/40 px-4 py-3">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{opp.opportunite}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[opp.stage ?? ""] ?? "bg-muted text-muted-foreground")}>
                    {opp.stage}
                  </span>
                  <span className="text-sm font-bold">{opp.montant}k€</span>
                </div>
                {opp.notes && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{opp.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Comptes Core Advisory ---- */}
      <section className="bento-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-bold tracking-tight">Comptes Core Advisory</h2>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border">
          {coreComptes.slice(0, 10).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-primary/[0.02] transition-colors duration-150">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{c.compte}</p>
                {c.notes && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{c.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.stage && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[c.stage] ?? "bg-muted text-muted-foreground")}>
                    {c.stage}
                  </span>
                )}
                {c.arrPondere != null && c.arrPondere > 0 && (
                  <span className="text-sm font-bold tabular-nums">{c.arrPondere}k€</span>
                )}
              </div>
            </div>
          ))}
          {coreComptes.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Aucun compte Core Advisory — catégorisez dans le Plan de comptes.</p>
          )}
        </div>
      </section>

      {/* ---- Cross-sell traction (cabinet + mixte seulement) ---- */}
      {view !== "moi" && (
        <section className="bento-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-500" />
            <h2 className="text-sm font-bold tracking-tight">Traction Cross-sell</h2>
            <span className="text-xs text-muted-foreground">
              {crossSellOpps.length} deals — {kpisCab.pipeline.toFixed(0)}k€ pondéré
            </span>
          </div>
          <div className="space-y-2">
            {(["Houda Al Alami", "Farah Rhouni", "Iliass Terchoune", "Ghita Arhmir"] as const).map((manager) => {
              const managerOpps = crossSellOpps.filter(o => o.opportunite.includes(manager));
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {managerOpps.length} deal{managerOpps.length > 1 ? "s" : ""} — {managerOpps.map(o => o.stage).join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- Notes de préparation ---- */}
      <section className="bento-card p-5 print:hidden">
        <h2 className="mb-3 text-sm font-bold tracking-tight">Notes de préparation</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Points à soulever, questions pour Iliass & Sébastien, blocages à escalader…"
          rows={5}
          className="w-full resize-none rounded-lg border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-150"
        />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* ExpandedPanel                                                         */
/* ------------------------------------------------------------------ */

function ExpandedPanel({
  panelKey, activeOpps, coreComptes, kpis, onClose,
}: {
  panelKey: PanelKey;
  activeOpps: Opportunite[];
  coreComptes: Compte[];
  kpis: ReturnType<typeof computeKpis>;
  onClose: () => void;
}) {
  if (panelKey === "won") {
    const wonDeals = activeOpps.filter(o => o.stage === "Won").sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0));
    return (
      <PanelShell
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        title="Deals Won"
        badge={`${wonDeals.length} deals · ${kpis.won.toFixed(0)}k€`}
        badgeCls="bg-emerald-100 text-emerald-700"
        borderCls="border-emerald-200/60 bg-emerald-50/40"
        onClose={onClose}
      >
        {wonDeals.length === 0
          ? <EmptyRow msg="Aucun deal Won dans cette vue." />
          : wonDeals.map(o => (
            <DealRow key={o.id}
              icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
              name={o.opportunite}
              sub={o.dateClose ? `Clôturé ${new Date(o.dateClose).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}` : undefined}
              right={<span className="text-sm font-bold text-emerald-700 tabular-nums">{o.montant}k€</span>}
              hoverCls="hover:bg-emerald-50/70"
            />
          ))
        }
      </PanelShell>
    );
  }

  if (panelKey === "pipeline") {
    const pipelineDeals = activeOpps
      .filter(o => o.stage !== "Won" && o.stage !== "Lost")
      .sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0));
    const pondTotal = pipelineDeals.reduce((s, o) => s + (o.montant ?? 0) * ((o.probabilite ?? 0) / 100), 0);
    return (
      <PanelShell
        icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        title="Pipeline actif"
        badge={`${pipelineDeals.length} deals · ${pondTotal.toFixed(0)}k€ pondéré`}
        badgeCls="bg-blue-100 text-blue-700"
        borderCls="border-blue-200/60 bg-blue-50/40"
        onClose={onClose}
      >
        {pipelineDeals.length === 0
          ? <EmptyRow msg="Aucun deal en cours dans cette vue." />
          : pipelineDeals.map(o => (
            <DealRow key={o.id}
              icon={
                <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[o.stage ?? ""] ?? "bg-muted text-muted-foreground")}>
                  {o.stage}
                </span>
              }
              name={o.opportunite}
              sub={o.nextStep ? o.nextStep : undefined}
              right={
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-blue-700 tabular-nums">{o.montant}k€</p>
                  {o.probabilite != null && <p className="text-[10px] text-muted-foreground">{o.probabilite}%</p>}
                </div>
              }
              hoverCls="hover:bg-blue-50/60"
            />
          ))
        }
      </PanelShell>
    );
  }

  if (panelKey === "active") {
    const STAGES_ORDER: OppStage[] = ["Negotiation", "Proposal", "Qualified", "Discovery"];
    return (
      <PanelShell
        icon={<Users className="h-4 w-4 text-violet-600" />}
        title="Deals actifs par stage"
        badge={`${activeOpps.filter(o => o.stage !== "Won" && o.stage !== "Lost").length} deals`}
        badgeCls="bg-violet-100 text-violet-700"
        borderCls="border-violet-200/60 bg-violet-50/40"
        onClose={onClose}
      >
        {STAGES_ORDER.map(stage => {
          const deals = activeOpps.filter(o => o.stage === stage).sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0));
          if (deals.length === 0) return null;
          const stageTotal = deals.reduce((s, o) => s + (o.montant ?? 0), 0);
          return (
            <React.Fragment key={stage}>
              <div className="flex items-center gap-2 px-5 py-2 bg-violet-50/60 border-b border-violet-200/40">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[stage])}>{stage}</span>
                <span className="text-xs text-muted-foreground">{deals.length} deal{deals.length > 1 ? "s" : ""} — {stageTotal}k€</span>
              </div>
              {deals.map(o => (
                <DealRow key={o.id}
                  icon={null}
                  name={o.opportunite}
                  sub={o.dateNextStep ? `Next step : ${new Date(o.dateNextStep).toLocaleDateString("fr-FR")}` : undefined}
                  right={<span className="text-sm font-bold text-violet-700 tabular-nums">{o.montant}k€</span>}
                  hoverCls="hover:bg-violet-50/60"
                />
              ))}
            </React.Fragment>
          );
        })}
        {activeOpps.filter(o => o.stage !== "Won" && o.stage !== "Lost").length === 0 && (
          <EmptyRow msg="Aucun deal actif dans cette vue." />
        )}
      </PanelShell>
    );
  }

  if (panelKey === "core") {
    return (
      <PanelShell
        icon={<Target className="h-4 w-4 text-orange-600" />}
        title="Comptes Core Advisory"
        badge={`${coreComptes.length} comptes`}
        badgeCls="bg-orange-100 text-orange-700"
        borderCls="border-orange-200/60 bg-orange-50/40"
        onClose={onClose}
      >
        {coreComptes.length === 0
          ? <EmptyRow msg="Aucun compte Core Advisory — catégorisez dans le Plan de comptes." />
          : coreComptes.map(c => (
            <DealRow key={c.id}
              icon={null}
              name={c.compte}
              sub={c.secteur ?? undefined}
              right={
                <div className="flex items-center gap-2 shrink-0">
                  {c.stage && (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", STAGE_CONFIG[c.stage] ?? "bg-muted text-muted-foreground")}>
                      {c.stage}
                    </span>
                  )}
                  {c.arrPondere != null && c.arrPondere > 0 && (
                    <span className="text-sm font-bold text-orange-700 tabular-nums">{c.arrPondere}k€</span>
                  )}
                </div>
              }
              hoverCls="hover:bg-orange-50/60"
            />
          ))
        }
      </PanelShell>
    );
  }

  return null;
}

function PanelShell({
  icon, title, badge, badgeCls, borderCls, onClose, children,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeCls: string;
  borderCls: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-xl border backdrop-blur-sm overflow-hidden", borderCls)}
     
    >
      <div className={cn("flex items-center justify-between px-5 py-3 border-b", borderCls)}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeCls)}>{badge}</span>
        </div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Fermer ×</button>
      </div>
      <div className="divide-y divide-black/[0.04]">{children}</div>
    </section>
  );
}

function DealRow({
  icon, name, sub, right, hoverCls,
}: {
  icon: React.ReactNode;
  name: string;
  sub?: string;
  right: React.ReactNode;
  hoverCls: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3 transition-colors duration-150", hoverCls)}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <p className="px-5 py-4 text-sm text-muted-foreground">{msg}</p>;
}

function KpiCard({
  label, value, sub, icon: Icon, color, onClick, active,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "emerald" | "violet" | "orange";
  onClick?: () => void;
  active?: boolean;
}) {
  const cm = {
    blue:    { bg: "bg-blue-50/60",    border: "border-blue-200/60",    icon: "text-blue-500",    val: "text-blue-900" },
    emerald: { bg: "bg-emerald-50/60", border: "border-emerald-200/60", icon: "text-emerald-500", val: "text-emerald-900" },
    violet:  { bg: "bg-violet-50/60",  border: "border-violet-200/60",  icon: "text-violet-500",  val: "text-violet-900" },
    orange:  { bg: "bg-orange-50/60",  border: "border-orange-200/60",  icon: "text-orange-500",  val: "text-orange-900" },
  }[color];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      className={cn(
        "rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.01] text-left w-full",
        cm.bg, cm.border,
        active && "ring-2 ring-emerald-400/60 shadow-md scale-[1.01]",
        onClick && "cursor-pointer"
      )}
      {...(onClick ? { onClick } : {})}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("h-4 w-4", cm.icon)} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tracking-tight", cm.val)}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </Tag>
  );
}

function MixtePanel({
  label, color, pipeline, won, deals,
}: {
  label: string;
  color: "blue" | "emerald";
  pipeline: number;
  won: number;
  deals: Opportunite[];
}) {
  const active = deals.filter(o => o.stage !== "Won" && o.stage !== "Lost").length;
  const wonCount = deals.filter(o => o.stage === "Won").length;
  const cm = {
    blue:    { bg: "bg-blue-50/40",    border: "border-blue-200/60",    header: "text-blue-700",    val: "text-blue-900",    badge: "bg-blue-100 text-blue-700" },
    emerald: { bg: "bg-emerald-50/40", border: "border-emerald-200/60", header: "text-emerald-700", val: "text-emerald-900", badge: "bg-emerald-100 text-emerald-700" },
  }[color];
  return (
    <div className={cn("rounded-xl border p-5", cm.bg, cm.border)}>
      <p className={cn("mb-4 text-sm font-bold", cm.header)}>{label}</p>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Pipeline pondéré</p>
          <p className={cn("text-3xl font-bold tracking-tight", cm.val)}>{pipeline.toFixed(0)}k€</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] text-muted-foreground">Revenue Won</p>
            <p className="text-lg font-bold">{won.toFixed(0)}k€</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] text-muted-foreground">Deals actifs</p>
            <p className="text-lg font-bold">{active} <span className="text-xs font-normal text-muted-foreground">({wonCount} Won)</span></p>
          </div>
        </div>
        <div className="pt-1">
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Top deals</p>
          <div className="space-y-1">
            {deals
              .filter(o => o.stage !== "Lost" && (o.montant ?? 0) >= 50)
              .sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0))
              .slice(0, 3)
              .map(o => (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate">{o.opportunite.replace(/^[📌👥]\s[\w\s]+—\s/, "")}</span>
                  <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", cm.badge)}>{o.montant}k€</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
