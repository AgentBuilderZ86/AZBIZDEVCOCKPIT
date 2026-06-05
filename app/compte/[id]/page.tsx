import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, FileDown, Zap } from "lucide-react";
import { getCompte360 } from "@/lib/notion";
import { resolveNextBestAction } from "@/lib/next-best-action-ai";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compte360Tabs } from "@/components/compte/compte-360-tabs";
import { PlanBlock } from "@/components/compte/plan-block";
import { EnrichDialog } from "@/components/compte/enrich-dialog";
import { CompteIntelligenceAside } from "@/components/compte/compte-intelligence-aside";
import { isIntelligenceEnabled, intelligenceConfig } from "@/lib/intelligence/config";
import { valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import type { Compte360 } from "@/lib/types";

export const dynamic = "force-dynamic";

const URGENCY_STYLES: Record<string, string> = {
  high: "border-red-300 bg-red-50",
  medium: "border-orange-300 bg-orange-50",
  low: "border-slate-200 bg-slate-50",
};

export default async function ComptePage({ params }: { params: { id: string } }) {
  let data: Compte360 | null = null;
  let error: string | null = null;

  try {
    data = await getCompte360(params.id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Erreur de chargement Notion.";
  }

  if (error || !data) {
    return (
      <main className="container mx-auto max-w-5xl py-8">
        <Link href="/comptes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Plan de comptes
        </Link>
        <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Impossible de charger ce compte.</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
        </div>
      </main>
    );
  }

  const { compte, contacts, opportunites, signaux } = data;
  const nba = await resolveNextBestAction(
    compte,
    contacts,
    opportunites,
    signaux
  );
  const pipeline = opportunites
    .filter((o) => o.stage && o.stage !== "Lost")
    .reduce((s, o) => s + (o.arrPondere ?? 0), 0);

  const intelligenceOn = isIntelligenceEnabled();
  const copilotEnabled =
    intelligenceOn && Boolean(intelligenceConfig().embeddingsApiKey);
  const intelligenceDisabledReason = !intelligenceOn
    ? "DATABASE_URL absente — migrez Postgres (npm run db:migrate)."
    : undefined;
  const copilotDisabledReason = intelligenceDisabledReason
    ? intelligenceDisabledReason
    : !intelligenceConfig().embeddingsApiKey
      ? "EMBEDDINGS_API_KEY absente — indexez des docs sur /connaissance."
      : undefined;

  return (
    <main className="container mx-auto max-w-6xl py-8">
      {/* Entête */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{compte.compte || "—"}</h1>
            {compte.accountId != null && (
              <span className="text-sm text-muted-foreground">#{compte.accountId}</span>
            )}
            {compte.url && (
              <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                <Link href={compte.url} target="_blank" title="Ouvrir dans Notion">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {compte.secteur && <Badge variant="outline" className="font-normal">{compte.secteur}</Badge>}
            {compte.priorite && (
              <Badge className={cn("font-normal", valueBadgeClass(compte.priorite))}>{compte.priorite}</Badge>
            )}
            {compte.stage && (
              <Badge className={cn("font-normal", valueBadgeClass(compte.stage))}>{compte.stage}</Badge>
            )}
            {compte.statutRelation && (
              <Badge className={cn("font-normal", valueBadgeClass(compte.statutRelation))}>
                {compte.statutRelation}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/compte/${compte.id}/pdf`} target="_blank" rel="noreferrer">
              <FileDown className="h-4 w-4" /> Focus PDF
            </a>
          </Button>
          <EnrichDialog compteId={compte.id} />
        </div>
      </header>

      {/* Firmo / KPIs */}
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Score AdilStar" value={compte.scoreAdilStar != null ? `★ ${compte.scoreAdilStar}` : "—"} />
        <Kpi label="ARR pondéré (k€)" value={compte.arrPondere != null ? String(compte.arrPondere) : "—"} />
        <Kpi label="Pipeline opps (k€)" value={pipeline ? pipeline.toFixed(1) : "—"} />
        <Kpi label="Effectif" value={compte.effectif != null ? String(compte.effectif) : "—"} />
        <Kpi label="CA estimé" value={compte.caEstime || "—"} />
        <Kpi label="Contacts" value={String(contacts.length)} />
      </section>

      {/* Next Best Action */}
      <section className="mt-5">
        <Card className={cn("border", URGENCY_STYLES[nba.urgency])}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" /> Next Best Action
              <Badge variant="outline" className="ml-1 font-normal capitalize">{nba.urgency}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{nba.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{nba.detail}</p>
          </CardContent>
        </Card>
      </section>

      {/* Corps : tabs + plan stratégique */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted" />}>
            <Compte360Tabs contacts={contacts} opportunites={opportunites} signaux={signaux} />
          </Suspense>
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Plan stratégique
            </h2>
            <PlanBlock compteId={compte.id} initial={compte.planStrategique} />
            {compte.notes && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
                <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{compte.notes}</p>
              </div>
            )}
          </div>
          <hr className="border-dashed" />
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Intelligence &amp; Activité
            </h2>
            <CompteIntelligenceAside
              compteId={compte.id}
              compteName={compte.compte}
              intelligenceOn={intelligenceOn}
              copilotEnabled={copilotEnabled}
              intelligenceDisabledReason={intelligenceDisabledReason}
              copilotDisabledReason={copilotDisabledReason}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
