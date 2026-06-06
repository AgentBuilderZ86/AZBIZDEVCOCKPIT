import Link from "next/link";
import { ArrowRight, Building2, TrendingUp, Flame, Clock, ChevronRight, Map, BookMarked } from "lucide-react";
import { listComptes } from "@/lib/notion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { badgeClass, valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import { OffreSynthesisWidget } from "@/components/dashboard/offre-synthesis-widget";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import type { Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const prioritaires = comptes
    .filter((c) => c.priorite === "🔴 Haute" || c.stage === "Hot")
    .sort((a, b) => (b.scoreAdilStar ?? 0) - (a.scoreAdilStar ?? 0))
    .slice(0, 6);

  const stats = [
    { label: "Comptes suivis", value: String(total), icon: Building2, color: "#3b5ff0" },
    { label: "ARR pondéré", value: `${arrTotal.toLocaleString("fr")} k€`, icon: TrendingUp, color: "#059669" },
    { label: "Hot / Active", value: String(hot), icon: Flame, color: "#ea580c" },
    { label: "Dormants", value: String(dormants), icon: Clock, color: "#8b5cf6" },
  ];

  return (
    <main className="container mx-auto max-w-6xl py-6 px-4">

      {/* Hero — compact */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cockpit commercial
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vision unifiée du portefeuille — enrichissement IA, scoring et plan stratégique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className="gap-1.5 font-medium shadow-sm"
            style={{
              background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 32%) 100%)",
              boxShadow: "0 1px 3px hsl(231 72% 20% / 0.3), inset 0 1px 0 hsl(231 50% 60% / 0.2)",
              border: "1px solid hsl(231 72% 30%)",
            }}
          >
            <Link href="/comptes">
              Plan de comptes <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-medium gap-1.5">
            <Link href="/roadmap"><Map className="h-3.5 w-3.5" /> Roadmap</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="font-medium gap-1.5">
            <Link href="/methodologie"><BookMarked className="h-3.5 w-3.5" /> Méthode</Link>
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
          {/* KPI Cards */}
          <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card group transition-all duration-200">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: `${color}14`, border: `1px solid ${color}28` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
              </div>
            ))}
          </section>

          {/* Synthèse Offres 360 */}
          {intelligenceOn && (
            <section className="mb-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Synthèse Offres 360°</h2>
              <OffreSynthesisWidget />
            </section>
          )}

          {/* 2-col layout : Comptes prioritaires + Tableau de bord rapide */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">

            {/* Colonne gauche : Comptes prioritaires */}
            {prioritaires.length > 0 && (
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Comptes prioritaires</h2>
                  <Link href="/comptes" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                    Voir tous <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <ul className="space-y-1.5">
                  {prioritaires.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/compte/${c.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-white/70 px-3.5 py-2.5 text-sm backdrop-blur-sm transition-all duration-150 hover:bg-white hover:shadow-sm hover:border-primary/20"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
                            style={{ background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 30%) 100%)" }}
                          >
                            {(c.compte || "?")[0].toUpperCase()}
                          </span>
                          <span className="truncate font-medium text-foreground">{c.compte || "—"}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {c.secteur && (
                            <Badge variant="outline" className="hidden font-normal sm:flex text-xs">
                              {c.secteur}
                            </Badge>
                          )}
                          {c.stage && (
                            <Badge className={cn("font-normal text-xs", valueBadgeClass(c.stage))}>
                              {c.stage}
                            </Badge>
                          )}
                          {c.scoreAdilStar != null && (
                            <span className="text-xs font-bold text-muted-foreground">★{c.scoreAdilStar}</span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Colonne droite : Tableau de bord rapide */}
            <aside className="space-y-3">
              {/* Score moyen */}
              <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Score moyen portefeuille</p>
                <p className="text-2xl font-bold text-foreground">★ {avgScore}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${avgScore}%` }}
                  />
                </div>
              </div>

              {/* Comptes chauds */}
              <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
                <p className="text-xs font-medium text-muted-foreground mb-1">Comptes Hot ou Warm</p>
                <p className="text-2xl font-bold text-foreground">{openOpps}</p>
                <p className="text-xs text-muted-foreground mt-0.5">comptes à activer en priorité</p>
              </div>

              {/* Liens rapides */}
              <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Accès rapides</p>
                {[
                  { href: "/connaissance", label: "Base de connaissance" },
                  { href: "/roadmap", label: "Roadmap 3 vagues" },
                  { href: "/methodologie", label: "Méthode & Indicateurs" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between text-sm text-foreground hover:text-primary hover:underline"
                  >
                    {link.label}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
