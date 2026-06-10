import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listComptes } from "@/lib/notion";
import { PortfolioGalaxy, type GalaxyStar } from "@/components/galaxy/portfolio-galaxy";
import { Button } from "@/components/ui/button";
import type { Compte } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GalaxyPage() {
  let comptes: Compte[] = [];
  let error: string | null = null;
  try {
    comptes = await listComptes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Erreur de chargement Notion.";
  }

  const stars: GalaxyStar[] = comptes.map((c) => ({
    id: c.id,
    nom: c.compte || "—",
    secteur: c.secteur || "Autre",
    stage: c.stage,
    score: c.scoreAdilStar,
    arr: c.arrPondere,
    // « À relancer » : dormant, ou froid/à prospecter — révélé par le mode radar.
    relancer:
      c.statutRelation === "Dormante" ||
      c.statutRelation === "À prospecter" ||
      c.stage === "Cold",
  }));

  return (
    <main className="container mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Portfolio <span className="text-gradient">Galaxy</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Ton portefeuille comme une galaxie vivante. Chaque étoile est un compte —
            sa <strong className="text-foreground">taille</strong> reflète l&apos;ARR pondéré,
            sa <strong className="text-foreground">lueur</strong> le stage, sa
            <strong className="text-foreground"> position</strong> le score AdilStar.
            Les comptes se regroupent en constellations par secteur. Survole pour explorer, clique pour ouvrir la fiche.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/"><ArrowLeft className="h-3.5 w-3.5" /> Cockpit</Link>
        </Button>
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          <p className="font-semibold">Connexion Notion en échec.</p>
          <p className="mt-1 font-mono text-xs opacity-75">{error}</p>
        </div>
      ) : stars.length === 0 ? (
        <div className="rounded-2xl border border-border/60 p-10 text-center text-sm text-muted-foreground">
          Aucun compte à afficher.
        </div>
      ) : (
        <PortfolioGalaxy stars={stars} />
      )}
    </main>
  );
}
