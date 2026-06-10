import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ChevronRight,
  Clock,
  Flame,
  TrendingUp,
  Star,
  Orbit,
  ListChecks,
  Gauge,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  Lost: "#64748b",
};

const STAGE_LEFT_BORDER: Record<string, string> = {
  Hot: "border-l-orange-400",
  Active: "border-l-blue-400",
  Warm: "border-l-amber-400",
  Won: "border-l-emerald-400",
  Cold: "border-l-slate-400",
  Lost: "border-l-slate-500",
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
  const dormants = comptes.filter(
    (c) => c.statutRelation === "Dormante" || c.statutRelation === "À prospecter"
  ).length;
  const avgScore = comptes.length
    ? Math.round(comptes.reduce((s, c) => s + (c.scoreAdilStar ?? 0), 0) / comptes.length)
    : 0;

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

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="container mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Cockpit <span className="text-gradient">commercial</span>
          </h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-1.5 font-medium">
            <Link href="/galaxy"><Orbit className="h-3.5 w-3.5" /> Galaxie</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/semaine"><CalendarCheck className="h-3.5 w-3.5" /><span className="hidden sm:inline">Ma semaine</span></Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link href="/comptes"><span className="hidden sm:inline">Comptes</span><ArrowRight className="h-3.5 w-3.5" /></Link>
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
          {/* ── ZONE 1 · Ruban KPI ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="ARR pondéré" value={arrTotal > 0 ? arrTotal.toLocaleString("fr") : "—"} unit="k€" icon={TrendingUp} hero />
            <StatTile label="Score moyen" value={String(avgScore)} unit="/100" icon={Star} tint="#eab308" />
            <StatTile label="Hot / Active" value={String(hot)} icon={Flame} tint="#ea580c" />
            <StatTile label="À relancer" value={String(dormants)} icon={Clock} tint="#a855f7" />
            <StatTile label="Comptes" value={String(total)} icon={Building2} tint="#3b82f6" />
          </div>

          {/* ── ZONE 2 · À faire aujourd'hui ───────────────────── */}
          <section className="space-y-3">
            <ZoneTitle icon={ListChecks} title="À faire aujourd'hui" subtitle="Tes actions et relances prioritaires" />
            {intelligenceOn ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <ActionsUrgentesWidget />
                <TachesSemaineWidget />
              </div>
            ) : (
              <div className="bento-card p-6 text-sm text-muted-foreground">
                Active la couche Intelligence (DATABASE_URL) pour piloter tes actions et relances du jour.
              </div>
            )}
          </section>

          {/* ── ZONE 3 · Portefeuille ──────────────────────────── */}
          <section className="space-y-3">
            <ZoneTitle
              icon={Building2}
              title="Portefeuille"
              subtitle={`${total} comptes · ${prioritaires.length} prioritaires`}
              action={
                <Link href="/comptes" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                  Voir tous <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {prioritaires.length === 0 ? (
                  <div className="bento-card p-6 text-center text-sm text-muted-foreground">
                    Aucun compte prioritaire ou Hot pour l&apos;instant.
                  </div>
                ) : (
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {prioritaires.map((c) => <AccountCard key={c.id} compte={c} />)}
                  </div>
                )}
              </div>

              {/* Répartition pipeline */}
              <div className="bento-card p-5">
                <p className="label-muted">Répartition pipeline</p>
                {total > 0 ? (
                  <div className="mt-3">
                    <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full">
                      {stageCounts.filter((s) => s.count > 0).map(({ label, count, color }) => (
                        <div key={label} title={`${label}: ${count}`} style={{ width: `${(count / total) * 100}%`, background: color }} />
                      ))}
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {stageCounts.filter((s) => s.count > 0).map(({ label, count, color }) => (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                            {label}
                          </span>
                          <span className="font-semibold text-foreground tabular-nums">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </section>

          {/* ── ZONE 4 · Pilotage ──────────────────────────────── */}
          <section className="space-y-3">
            <ZoneTitle icon={Gauge} title="Pilotage" subtitle="Cadence, appels d'offres et synthèse offres" />
            <div className="grid gap-4 lg:grid-cols-2">
              <GamificationSection intelligenceOn={intelligenceOn} />
              {intelligenceOn && <AoHealthWidget />}
            </div>
            {intelligenceOn && <OffreSynthesisWidget />}
          </section>
        </>
      )}
    </main>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function StatTile({
  label, value, unit, icon: Icon, hero, tint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  hero?: boolean;
  tint?: string;
}) {
  return (
    <div className={cn("bento-card p-4", hero && "border-gradient")}>
      <div className="flex items-center justify-between">
        <p className="label-muted">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground/70" style={tint ? { color: tint } : undefined} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">
        {hero ? <span className="text-gradient">{value}</span> : value}
        {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

function ZoneTitle({
  icon: Icon, title, subtitle, action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
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
  const borderClass = STAGE_LEFT_BORDER[c.stage ?? "Cold"] ?? "border-l-slate-400";

  return (
    <Link
      href={`/compte/${c.id}`}
      className={cn("group bento-card flex flex-col gap-2.5 border-l-[3px] p-3.5 no-underline", borderClass)}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aurora-gradient text-xs font-bold text-white">
          {letter}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground transition-colors duration-150 group-hover:text-primary">
            {c.compte || "—"}
          </p>
          {c.secteur && <p className="truncate text-xs text-muted-foreground/70">{c.secteur}</p>}
        </div>
        {c.scoreAdilStar != null && (
          <span className="shrink-0 text-base font-bold tabular-nums text-primary/70">{c.scoreAdilStar}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-wrap gap-1">
          {c.stage && (
            <Badge className={cn("rounded-full px-2 py-0 text-xs font-medium", valueBadgeClass(c.stage))}>{c.stage}</Badge>
          )}
          {c.priorite && (
            <Badge variant="outline" className="rounded-full px-2 py-0 text-xs font-normal text-muted-foreground">
              {PRIORITY_SHORT[c.priorite] ?? c.priorite}
            </Badge>
          )}
        </div>
        {c.arrPondere != null && c.arrPondere > 0 && (
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">{c.arrPondere}k€</span>
        )}
      </div>
    </Link>
  );
}
