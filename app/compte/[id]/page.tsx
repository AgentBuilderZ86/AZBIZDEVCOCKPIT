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
import { OffreMappingPanel } from "@/components/compte/offre-mapping-panel";
import { isIntelligenceEnabled, intelligenceConfig } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { valueBadgeClass } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";
import type { Compte360, TacheRow } from "@/lib/types";

interface AoRow {
  id: string;
  titre: string;
  client: string;
  statut: string;
  score_fit: number | null;
  budget_k_eur: number | null;
  deadline: string | null;
  synthese: string;
  suggestion: string;
}

interface ActionRow {
  id: string;
  action_text: string;
  target_contacts: string;
  linked_offer: string | null;
  horizon: string;
  status: string;
  done_at: string | null;
  done_type: string | null;
  done_notes: string | null;
}

export const dynamic = "force-dynamic";

const URGENCY_STYLES: Record<string, string> = {
  high: "border-red-300 bg-red-50",
  medium: "border-orange-300 bg-orange-50",
  low: "border-slate-200 bg-slate-50",
};

export default async function ComptePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  const intelligenceOn = isIntelligenceEnabled();
  let aos: AoRow[] = [];
  let actions: ActionRow[] = [];
  let taches: TacheRow[] = [];

  if (intelligenceOn) {
    const db = getDb();
    [aos, actions, taches] = await Promise.all([
      db<AoRow[]>`
        SELECT id, titre, client, statut, score_fit, budget_k_eur, deadline, synthese, suggestion
        FROM ao_submissions
        WHERE compte_notion_id = ${params.id}
        ORDER BY deadline ASC NULLS LAST
        LIMIT 20
      `.catch(() => []),
      db<ActionRow[]>`
        SELECT id, action_text, target_contacts, linked_offer, horizon, status, done_at, done_type, done_notes
        FROM revue_actions
        WHERE compte_id = ${params.id}
        ORDER BY status ASC, horizon ASC, generated_at ASC
        LIMIT 30
      `.catch(() => []),
      db<TacheRow[]>`
        SELECT id, compte_id, compte_nom, scope, cible_id, cible_nom,
               type, titre, notes, priorite, due_date, status, done_at
        FROM taches
        WHERE compte_id = ${params.id} AND status <> 'done'
        ORDER BY (due_date IS NULL), due_date ASC,
                 CASE priorite WHEN 'haute' THEN 0 WHEN 'moyenne' THEN 1 ELSE 2 END,
                 created_at DESC
        LIMIT 50
      `.catch(() => []),
    ]);
  }

  const nba = await resolveNextBestAction(
    compte,
    contacts,
    opportunites,
    signaux
  );
  const pipeline = opportunites
    .filter((o) => o.stage && o.stage !== "Lost")
    .reduce((s, o) => s + (o.arrPondere ?? 0), 0);
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
    <main className="container mx-auto max-w-6xl py-4 px-4">
      {/* Entête */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{compte.compte || "—"}</h1>
            {compte.accountId != null && (
              <span className="text-sm text-muted-foreground/70">#{compte.accountId}</span>
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
            {compte.secteur && (
              <Badge variant="outline" className="rounded-full px-3 font-normal">
                {compte.secteur}
              </Badge>
            )}
            {compte.priorite && (
              <Badge className={cn("rounded-full px-3 font-normal", valueBadgeClass(compte.priorite))}>
                {compte.priorite}
              </Badge>
            )}
            {compte.stage && (
              <Badge className={cn("rounded-full px-3 font-normal", valueBadgeClass(compte.stage))}>
                {compte.stage}
              </Badge>
            )}
            {compte.statutRelation && (
              <Badge className={cn("rounded-full px-3 font-normal", valueBadgeClass(compte.statutRelation))}>
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

      {/* Bento KPI row */}
      <section className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {/* Score AdilStar — hero */}
        <div
          className="col-span-1 rounded-xl border backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] p-4"
          style={{
            background:
              "linear-gradient(135deg, hsl(231 72% 38% / 0.06) 0%, hsl(231 60% 55% / 0.10) 100%)",
            boxShadow:
              "0 1px 3px hsl(220 20% 0% / 0.05), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
          }}
        >
          <p className="label-muted">Score AdilStar</p>
          <p className="mt-1 text-3xl font-bold tracking-tighter text-primary">
            {compte.scoreAdilStar != null ? `★ ${compte.scoreAdilStar}` : "—"}
          </p>
          {compte.scoreAdilStar != null && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${compte.scoreAdilStar}%` }}
              />
            </div>
          )}
        </div>
        <Kpi label="ARR pondéré (k€)" value={compte.arrPondere != null ? String(compte.arrPondere) : "—"} />
        <Kpi label="Pipeline opps (k€)" value={pipeline ? pipeline.toFixed(1) : "—"} />
        <Kpi label="Effectif" value={compte.effectif != null ? String(compte.effectif) : "—"} />
        <Kpi label="CA estimé" value={compte.caEstime || "—"} />
        <Kpi label="Contacts" value={String(contacts.length)} />
      </section>

      {/* Next Best Action */}
      <section className="mt-3">
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
      <section className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-md bg-muted" />}>
            <Compte360Tabs
              contacts={contacts}
              opportunites={opportunites}
              signaux={signaux}
              aos={aos}
              actions={actions}
              taches={taches}
              compteId={compte.id}
              compteNom={compte.compte}
            />
          </Suspense>
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Offre Mapping &amp; Plan d'Action
            </h2>
            <OffreMappingPanel compteId={compte.id} intelligenceOn={intelligenceOn} />
          </div>
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
    <div
      className="rounded-xl border bg-white/75 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.02]"
      style={{
        boxShadow:
          "0 1px 3px hsl(220 20% 0% / 0.05), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
      }}
    >
      <p className="label-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}
