import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listComptes } from "@/lib/notion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { badgeClass } from "@/lib/compte-ui";
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

  return (
    <main className="container mx-auto max-w-5xl py-12">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">★ Adil BizDev OS</p>
        <h1 className="text-3xl font-bold">Cockpit Comptes</h1>
        <p className="mt-1 text-muted-foreground">
          Pilotage du portefeuille — source de vérité : Notion.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Connexion Notion en échec.</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
        </div>
      ) : (
        <>
          <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Comptes" value={String(total)} />
            <Stat label="ARR pondéré" value={`${arrTotal.toLocaleString("fr")} k€`} />
            <Stat label="Hot / Active" value={String(hot)} />
            <Stat label="Dormants" value={String(dormants)} />
          </section>

          <div className="mb-6">
            <Button asChild>
              <Link href="/comptes">
                Ouvrir le plan de comptes <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              Comptes (lecture Notion)
            </h2>
            <ul className="divide-y rounded-md border">
              {comptes.length === 0 && (
                <li className="p-4 text-sm text-muted-foreground">
                  Aucun compte trouvé dans la base Notion.
                </li>
              )}
              {comptes.slice(0, 12).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="font-medium">{c.compte || "—"}</span>
                  <div className="flex items-center gap-1.5">
                    {c.secteur && (
                      <Badge variant="outline" className="font-normal">
                        {c.secteur}
                      </Badge>
                    )}
                    {c.stage && (
                      <Badge className={cn("font-normal", badgeClass("stage", c.stage))}>
                        {c.stage}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {comptes.length > 12 && (
              <p className="mt-2 text-xs text-muted-foreground">
                + {comptes.length - 12} autres dans le plan de comptes.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
