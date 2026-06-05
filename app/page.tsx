import Link from "next/link";
import { ArrowRight, Building2, TrendingUp, Flame, Clock, ChevronRight } from "lucide-react";
import { listComptes } from "@/lib/notion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { badgeClass, valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import type { Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let comptes: Compte[] = [];
  let error: string | null = null;

  try {
    comptes = await listComptes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Erreur de chargement Notion.";
  }

  const total = comptes.length;
  const arrTotal = comptes.reduce((s, c) => s + (c.arrPondere ?? 0), 0);
  const hot = comptes.filter((c) => c.stage === "Hot" || c.stage === "Active").length;
  const dormants = comptes.filter((c) => c.statutRelation === "Dormante").length;

  const prioritaires = comptes
    .filter((c) => c.priorite === "🔴 Haute" || c.stage === "Hot")
    .sort((a, b) => (b.scoreAdilStar ?? 0) - (a.scoreAdilStar ?? 0))
    .slice(0, 5);

  const stats = [
    { label: "Comptes suivis", value: String(total), icon: Building2, color: "#3b5ff0" },
    { label: "ARR pondéré", value: `${arrTotal.toLocaleString("fr")} k€`, icon: TrendingUp, color: "#059669" },
    { label: "Hot / Active", value: String(hot), icon: Flame, color: "#ea580c" },
    { label: "Dormants", value: String(dormants), icon: Clock, color: "#8b5cf6" },
  ];

  return (
    <main className="container mx-auto max-w-5xl py-10">

      {/* Hero */}
      <header className="mb-10">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
            border: "1px solid hsl(231 72% 38% / 0.18)",
            color: "hsl(231 72% 36%)",
          }}>
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Adil BizDev OS · Données Notion en temps réel
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Cockpit commercial
        </h1>
        <p className="mt-2 text-base text-muted-foreground max-w-xl">
          Vision unifiée du portefeuille comptes — enrichissement IA, scoring et plan stratégique.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <p className="font-semibold">Connexion Notion en échec.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card group transition-all duration-200">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{
                      background: `${color}14`,
                      border: `1px solid ${color}28`,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </span>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
              </div>
            ))}
          </section>

          {/* CTA principal */}
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Button
              asChild
              className="gap-2 font-medium shadow-sm"
              style={{
                background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 32%) 100%)",
                boxShadow: "0 1px 3px hsl(231 72% 20% / 0.3), 0 4px 14px hsl(231 72% 38% / 0.25), inset 0 1px 0 hsl(231 50% 60% / 0.2)",
                border: "1px solid hsl(231 72% 30%)",
              }}
            >
              <Link href="/comptes">
                Plan de comptes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="font-medium">
              <Link href="/connaissance">Base de connaissance</Link>
            </Button>
          </div>

          {/* Comptes prioritaires */}
          {prioritaires.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Comptes prioritaires à activer
                </h2>
                <Link
                  href="/comptes"
                  className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                >
                  Voir tous <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="space-y-1.5">
                {prioritaires.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/compte/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border bg-white/70 px-4 py-3 text-sm backdrop-blur-sm transition-all duration-150 hover:bg-white hover:shadow-sm hover:border-primary/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                          style={{
                            background: "linear-gradient(135deg, hsl(231 72% 42%) 0%, hsl(231 72% 30%) 100%)",
                          }}
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
                        {c.priorite && (
                          <Badge className={cn("font-normal text-xs", valueBadgeClass(c.priorite))}>
                            {c.priorite}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Liste complète (aperçu) */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Tous les comptes · aperçu
            </h2>
            <ul className="divide-y rounded-xl border bg-white/60 backdrop-blur-sm overflow-hidden">
              {comptes.length === 0 && (
                <li className="p-4 text-sm text-muted-foreground">
                  Aucun compte trouvé dans la base Notion.
                </li>
              )}
              {comptes.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/compte/${c.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/30"
                  >
                    <span className="font-medium truncate">{c.compte || "—"}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {c.secteur && (
                        <Badge variant="outline" className="hidden font-normal sm:flex text-xs">
                          {c.secteur}
                        </Badge>
                      )}
                      {c.stage && (
                        <Badge className={cn("font-normal text-xs", badgeClass("stage", c.stage))}>
                          {c.stage}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {comptes.length > 12 && (
              <Link
                href="/comptes"
                className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                + {comptes.length - 12} autres dans le plan de comptes
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </section>
        </>
      )}
    </main>
  );
}
