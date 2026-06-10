import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ChevronRight,
  Clock,
  Flame,
  Map,
  BookMarked,
  TrendingUp,
  Star,
  Orbit,
} from "lucide-react";
import { listComptes } from "@/lib/notion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import { OffreSynthesisWidget } from "@/components/dashboard/offre-synthesis-widget";
import { GamificationSection } from "@/components/dashboard/gamification-section";
import { AoHealthWidget } from "@/components/dashboard/ao-health-widget";
import { ActionsUrgentesWidget } from "@/components/dashboard/actions-urgentes-widget";
import { TachesSemaineWidget } from "@/components/dashboard/taches-semaine-widget";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import type { Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

const STAGE_COLORS: Record<string, string> = {
  Cold: "#94a3b8",
  Warm: "#f59e0b",
  Hot: "#ea580c",
  Active: "#3b82f6",
  Won: "#10b981",
  Lost: "#e2e8f0",
};

const STAGE_LEFT_BORDER: Record<string, string> = {
  Hot: "border-l-orange-400",
  Active: "border-l-blue-400",
  Warm: "border-l-amber-400",
  Won: "border-l-emerald-400",
  Cold: "border-l-slate-300",
  Lost: "border-l-slate-200",
};

export default async function HomePage() {
  let comptes: Compte[] = [];
  let error: string | null = null;
  const intelligenceOn = isIntelligenceEnabled();

  try {
    comptes = await listComptes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Erreur de chargement Notion.";
  }

  const total = comptes.length;
  const arrTotal = comptes.reduce((s, c) => s + (c.arrPondere ?? 0), 0);
  const hot = comptes.filter((c) => c.stage === "Hot" || c.stage === "Active").length;
  const dormants = comptes.filter((c) => c.statutRelation === "Dormante").length;
  const avgScore = comptes.length
    ? Math.round(comptes.reduce((s, c) => s + (c.scoreAdilStar ?? 0), 0) / comptes.length)
    : 0;
  const openOpps = comptes.filter((c) => c.stage === "Hot" || c.stage === "Warm").length;

  // Stage distribution (funnel)
  const stages = ["Cold", "Warm", "Hot", "Active", "Won"] as const;
  const stageCounts = stages.map((s) => ({
    label: s,
    count: comptes.filter((c) => c.stage === s).length,
    color: STAGE_COLORS[s],
  }));

  const prioritaires = comptes
    .filter((c) => c.priorite === "🔴 Haute" || c.stage === "Hot")
    .sort((a, b) => (b.scoreAdilStar ?? 0) - (a.scoreAdilStar ?? 0))
    .slice(0, 6);

  return (
    <main className="container mx-auto max-w-7xl py-5 px-4">

      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Cockpit <span className="text-gradient">commercial</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vision unifiée du portefeuille · {total} comptes · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-1.5 font-medium">
            <Link href="/galaxy"><Orbit className="h-3.5 w-3.5" /> Galaxie</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/comptes">Plan de comptes <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/semaine"><CalendarCheck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ma semaine</span></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/roadmap"><Map className="h-3.5 w-3.5" /><span className="hidden sm:inline">Roadmap</span></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/methodologie"><BookMarked className="h-3.5 w-3.5" /><span className="hidden sm:inline">Méthode</span></Link>
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <p className="font-semibold">Connexion Notion en échec.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : (
        <>
          {/* ─── MASTER BENTO GRID ─────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

            {/* ── COL 1 : Pipeline & KPIs ── */}
            <div className="flex flex-col gap-3">

              {/* ARR Hero */}
              <div className="bento-card p-6">
                <p className="label-muted">Pipeline ARR pondéré</p>
                <p className="mt-2 font-display text-4xl font-bold tracking-tight">
                  <span className="text-gradient">{arrTotal > 0 ? arrTotal.toLocaleString("fr") : "—"}</span>
                  <span className="ml-1.5 text-base font-medium text-muted-foreground">k€</span>
                </p>

                {/* Score gauge */}
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${avgScore}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-sm font-bold text-muted-foreground">
                    ★ {avgScore}<span className="font-normal">/100</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground/70">Score moyen portefeuille</p>

                {/* Funnel stageDist */}
                {total > 0 && (
                  <div className="mt-4">
                    <div className="flex h-2 w-full overflow-hidden rounded-full gap-px">
                      {stageCounts.filter((s) => s.count > 0).map(({ label, count, color }) => (
                        <div
                          key={label}
                          title={`${label}: ${count}`}
                          className="transition-all duration-300"
                          style={{ width: `${(count / total) * 100}%`, background: color }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                      {stageCounts.filter((s) => s.count > 0).map(({ label, count, color }) => (
                        <span key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                          {label} <span className="font-medium text-foreground">{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2×2 KPI grid */}
              <div className="grid grid-cols-2 gap-2">
                <MiniKpi label="Hot / Active" value={hot} icon={<Flame className="h-3.5 w-3.5" />} color="#ea580c" />
                <MiniKpi label="Warm + Hot" value={openOpps} icon={<TrendingUp className="h-3.5 w-3.5" />} color="#f59e0b" />
                <MiniKpi label="Total comptes" value={total} icon={<Building2 className="h-3.5 w-3.5" />} color="#3b82f6" />
                <MiniKpi label="Dormants" value={dormants} icon={<Clock className="h-3.5 w-3.5" />} color="#8b5cf6" />
              </div>
            </div>

            {/* ── COL 2 : Comptes prioritaires (carte grid) ── */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Comptes prioritaires</h2>
                <Link
                  href="/comptes"
                  className="flex items-center gap-0.5 text-xs font-medium text-primary transition-colors hover:underline"
                >
                  Voir tous <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {prioritaires.length === 0 ? (
                <div className="bento-card p-6 text-center text-sm text-muted-foreground">
                  Aucun compte prioritaire ou Hot pour l&apos;instant.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {prioritaires.map((c) => (
                    <AccountCard key={c.id} compte={c} />
                  ))}
                </div>
              )}

              {/* Accès rapides */}
              <div className="bento-card p-4">
                <p className="label-muted mb-2.5">Navigation</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { href: "/connaissance", label: "Connaissance", icon: Star },
                    { href: "/roadmap", label: "Roadmap", icon: Map },
                    { href: "/methodologie", label: "Méthode", icon: BookMarked },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-primary/5 hover:text-primary transition-all duration-150 hover:scale-[1.04]"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ── COL 3 : Gamification + AO + Actions ── */}
            <div className="flex flex-col gap-3">
              <GamificationSection intelligenceOn={intelligenceOn} />
              {intelligenceOn && <TachesSemaineWidget />}
              {intelligenceOn && <AoHealthWidget />}
              {intelligenceOn && <ActionsUrgentesWidget />}
            </div>
          </div>

          {/* ─── OFFRE SYNTHESIS (si intelligence activée) ─── */}
          {intelligenceOn && (
            <section className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Synthèse Offres 360°</h2>
              </div>
              <OffreSynthesisWidget />
            </section>
          )}
        </>
      )}
    </main>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function MiniKpi({
  label, value, icon, color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      className="bento-card p-3.5 flex flex-col gap-1"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </span>
      </div>
      <p className="text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

const PRIORITY_SHORT: Record<string, string> = {
  "🔴 Haute": "Haute",
  "🟡 Moyenne": "Moy.",
  "🟢 Basse": "Basse",
};

function AccountCard({ compte: c }: { compte: Compte }) {
  const letter = (c.compte || "?")[0].toUpperCase();
  const borderClass = STAGE_LEFT_BORDER[c.stage ?? "Cold"] ?? "border-l-slate-300";

  return (
    <Link
      href={`/compte/${c.id}`}
      className={cn(
        "group bento-card flex flex-col gap-2.5 border-l-[3px] p-3.5 no-underline",
        borderClass
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 30%) 100%)",
          }}
        >
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground group-hover:text-primary transition-colors duration-150">
            {c.compte || "—"}
          </p>
          {c.secteur && (
            <p className="truncate text-xs text-muted-foreground/70">{c.secteur}</p>
          )}
        </div>
        {c.scoreAdilStar != null && (
          <span className="shrink-0 text-base font-bold text-primary/60 tabular-nums">
            {c.scoreAdilStar}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-wrap gap-1">
          {c.stage && (
            <Badge className={cn("rounded-full px-2 py-0 text-xs font-medium", valueBadgeClass(c.stage))}>
              {c.stage}
            </Badge>
          )}
          {c.priorite && (
            <Badge variant="outline" className="rounded-full px-2 py-0 text-xs font-normal text-muted-foreground">
              {PRIORITY_SHORT[c.priorite] ?? c.priorite}
            </Badge>
          )}
        </div>
        {c.arrPondere != null && c.arrPondere > 0 && (
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            {c.arrPondere}k€
          </span>
        )}
      </div>
    </Link>
  );
}
