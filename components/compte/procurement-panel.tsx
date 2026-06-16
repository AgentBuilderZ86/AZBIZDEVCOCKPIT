"use client";

import * as React from "react";
import { ShoppingCart, Mail, Phone, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseApiJson } from "@/lib/parse-api-json";

interface ProcurementData {
  emailAchats: string | null;
  achatsPhone: string | null;
  referencementUrl: string | null;
  fournisseurPortalUrl: string | null;
  procedureSteps: string[];
  synthese: string;
  sources: string[];
  confidence: string;
  status: string;
  researchedAt: string | null;
}

interface Props {
  compteId: string;
  intelligenceOn: boolean;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  haute: "bg-emerald-100 text-emerald-800",
  moyenne: "bg-amber-100 text-amber-800",
  faible: "bg-slate-100 text-slate-700",
};

export function ProcurementPanel({ compteId, intelligenceOn }: Props) {
  const [data, setData] = React.useState<ProcurementData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [researching, setResearching] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/compte/${compteId}/procurement`);
      const json = await parseApiJson(res);
      setData((json.procurement as ProcurementData | null) ?? null);
    } catch {
      /* silencieux — affiche l'état vide */
    } finally {
      setLoading(false);
    }
  }, [compteId]);

  React.useEffect(() => {
    if (intelligenceOn) load();
    else setLoading(false);
  }, [intelligenceOn, load]);

  async function pollJob(jobId: string): Promise<void> {
    const MAX = 18; // 18 × 3s = 54s
    for (let i = 0; i < MAX; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/intelligence/jobs/${jobId}`);
        const json = await parseApiJson(res);
        if (!res.ok) continue;
        const job = json.job as { status: string; error?: string } | undefined;
        if (!job) continue;
        if (job.status === "failed") throw new Error(String(job.error ?? "Recherche échouée."));
        if (job.status === "done") return;
      } catch (err) {
        if (err instanceof Error && err.message.includes("échouée")) throw err;
        // erreur réseau transitoire — continuer
      }
    }
    throw new Error("Délai dépassé. Réessayez dans quelques instants.");
  }

  async function runResearch() {
    setResearching(true);
    try {
      const res = await fetch(`/api/compte/${compteId}/procurement`, { method: "POST" });
      const json = await parseApiJson(res);
      if (!res.ok) throw new Error(String(json.error ?? "Échec du lancement."));
      if (json.queued && json.jobId) {
        await pollJob(String(json.jobId));
        await load();
        toast.success("Référencement achats mis à jour.");
      } else {
        throw new Error(String(json.error ?? "Réponse inattendue."));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur recherche achats.");
    } finally {
      setResearching(false);
    }
  }

  function copyEmail() {
    if (!data?.emailAchats) return;
    void navigator.clipboard.writeText(data.emailAchats);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!intelligenceOn) {
    return (
      <p className="text-xs text-muted-foreground">
        Couche Intelligence inactive (DATABASE_URL) — référencement achats indisponible.
      </p>
    );
  }

  const hasContent =
    data && (data.emailAchats || data.fournisseurPortalUrl || data.referencementUrl || data.procedureSteps.length > 0);

  return (
    <div className="rounded-xl border bg-white/70 p-4 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Référencement Achats</span>
          {data?.confidence && (
            <Badge className={CONFIDENCE_STYLES[data.confidence] ?? "bg-slate-100 text-slate-700"}>
              {data.confidence}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={runResearch} disabled={researching}>
          <RefreshCw className={researching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {researching ? "Recherche…" : hasContent ? "Actualiser" : "Rechercher"}
        </Button>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      ) : !hasContent ? (
        <p className="text-xs text-muted-foreground">
          {data?.status === "empty"
            ? "Aucun contact achats fiable trouvé sur le web. Réessayez plus tard."
            : "Pas encore recherché. Lancez la recherche web du moyen de contact de la Direction des Achats et de la procédure de référencement."}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {data.emailAchats && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <a href={`mailto:${data.emailAchats}`} className="font-medium text-primary hover:underline">
                {data.emailAchats}
              </a>
              <button
                onClick={copyEmail}
                className="text-muted-foreground hover:text-foreground"
                title="Copier l'email"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
          {data.achatsPhone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{data.achatsPhone}</span>
            </div>
          )}
          {data.fournisseurPortalUrl && (
            <a
              href={data.fournisseurPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Portail fournisseurs
            </a>
          )}
          {data.referencementUrl && data.referencementUrl !== data.fournisseurPortalUrl && (
            <a
              href={data.referencementUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Page « Devenir fournisseur »
            </a>
          )}

          {data.procedureSteps.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Procédure de référencement
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                {data.procedureSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {data.synthese && (
            <p className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs text-muted-foreground">
              {data.synthese}
            </p>
          )}

          {data.sources.length > 0 && (
            <p className="text-[11px] text-muted-foreground/80">
              Sources :{" "}
              {data.sources.map((s, i) => (
                <a key={i} href={s} target="_blank" rel="noreferrer" className="underline">
                  [{i + 1}]
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
