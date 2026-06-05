"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SECTEURS } from "@/lib/types";
import type {
  KnowledgeDocSummary,
  KnowledgeSearchHit,
} from "@/lib/intelligence/knowledge-types";

interface Props {
  intelligenceEnabled: boolean;
  initialDocs: KnowledgeDocSummary[];
}

/** Lit le corps JSON ou remonte un message lisible (ex. 500 Netlify en texte brut). */
async function parseApiJson(res: Response): Promise<{ error?: string; [key: string]: unknown }> {
  const raw = await res.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as { error?: string; [key: string]: unknown };
  } catch {
    const preview = raw.replace(/\s+/g, " ").slice(0, 160);
    throw new Error(
      res.ok
        ? "Réponse serveur invalide."
        : preview.startsWith("Internal")
          ? "timeout"
          : preview || `Erreur HTTP ${res.status}.`
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollIngestJob(
  jobId: string,
  docTitle: string,
  onProgress: (pct: number) => void
): Promise<void> {
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    onProgress(Math.min(95, Math.round(((i + 1) / maxAttempts) * 100)));
    const res = await fetch(`/api/intelligence/jobs/${jobId}`);
    const job = await parseApiJson(res);
    if (!res.ok) throw new Error(String(job.error ?? "Job introuvable."));
    if (job.status === "done") {
      const result = job.result as { chunkCount?: number } | undefined;
      const chunks = result?.chunkCount ?? "?";
      toast.success(`Indexé : « ${docTitle} » — ${chunks} chunk(s).`);
      return;
    }
    if (job.status === "failed") {
      throw new Error(String(job.error ?? "Échec indexation."));
    }
  }
  throw new Error("timeout");
}

export function ConnaissanceClient({ intelligenceEnabled, initialDocs }: Props) {
  const [docs, setDocs] = React.useState(initialDocs);
  const [uploading, setUploading] = React.useState(false);
  const [pollProgress, setPollProgress] = React.useState<number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [sectorFilter, setSectorFilter] = React.useState<string>("");
  const [hits, setHits] = React.useState<KnowledgeSearchHit[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [sourceType, setSourceType] = React.useState("propale");
  const [sector, setSector] = React.useState<string>("");
  const [outcome, setOutcome] = React.useState<string>("");
  const [notionUrl, setNotionUrl] = React.useState("");
  const [notionTitle, setNotionTitle] = React.useState("");
  const [ingestingNotion, setIngestingNotion] = React.useState(false);

  const pendingDeleteTitle = pendingDeleteId
    ? docs.find((d) => d.id === pendingDeleteId)?.title ?? "ce document"
    : null;

  async function refreshDocs() {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    if (res.ok && data.docs) setDocs(data.docs);
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (title) fd.set("title", title);
    if (sourceType) fd.set("sourceType", sourceType);
    if (sector) fd.set("sector", sector);
    if (outcome) fd.set("outcome", outcome);

    setUploading(true);
    setUploadError(null);
    setPollProgress(null);
    try {
      const res = await fetch("/api/knowledge/ingest", {
        method: "POST",
        body: fd,
      });
      const data = await parseApiJson(res);

      if (res.status === 202 && data.queued && data.jobId) {
        toast.info(
          typeof data.message === "string"
            ? data.message
            : "Indexation en cours…"
        );
        setPollProgress(0);
        await pollIngestJob(
          String(data.jobId),
          String(data.title ?? title),
          setPollProgress
        );
        form.reset();
        setTitle("");
        await refreshDocs();
        return;
      }

      if (!res.ok) throw new Error(String(data.error ?? "Échec ingestion."));
      toast.success(
        `Indexé : « ${data.title} » — ${data.chunkCount} chunk(s).`
      );
      form.reset();
      setTitle("");
      await refreshDocs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur upload.";
      if (msg === "timeout") {
        setUploadError("timeout");
      } else {
        toast.error(msg);
      }
    } finally {
      setUploading(false);
      setPollProgress(null);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sector: sectorFilter || null,
          k: 8,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec recherche.");
      setHits(data.hits ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur recherche.");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function onIngestNotion(e: React.FormEvent) {
    e.preventDefault();
    if (!notionUrl.trim()) return;
    setIngestingNotion(true);
    try {
      const res = await fetch("/api/knowledge/ingest-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notionUrl: notionUrl.trim(),
          title: notionTitle.trim() || undefined,
          sector: sector || undefined,
          outcome: outcome || undefined,
        }),
      });
      const data = await parseApiJson(res);

      if (res.status === 202 && data.queued && data.jobId) {
        toast.info(
          typeof data.message === "string"
            ? data.message
            : "Indexation Notion en cours…"
        );
        await pollIngestJob(
          String(data.jobId),
          String(data.title ?? notionTitle ?? "Page Notion"),
          () => {}
        );
        setNotionUrl("");
        setNotionTitle("");
        await refreshDocs();
        return;
      }

      if (!res.ok) throw new Error(String(data.error ?? "Échec Notion."));
      toast.success(
        `Indexé depuis Notion : « ${data.title} » — ${data.chunkCount} chunk(s).`
      );
      setNotionUrl("");
      setNotionTitle("");
      await refreshDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur Notion.");
    } finally {
      setIngestingNotion(false);
    }
  }

  async function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Suppression impossible.");
        return;
      }
      toast.success("Document supprimé.");
      await refreshDocs();
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  }

  if (!intelligenceEnabled) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Couche Intelligence inactive</p>
        <p className="mt-1">
          Configurez <code className="text-xs">DATABASE_URL</code> et{" "}
          <code className="text-xs">EMBEDDINGS_API_KEY</code>, puis exécutez{" "}
          <code className="text-xs">npm run db:migrate</code>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Indexer un document</h2>
          <form onSubmit={onUpload} className="space-y-3 rounded-md border p-4">
            <div>
              <Label htmlFor="file">Fichier (.txt, .md, .pdf)</Label>
              <Input id="file" name="file" type="file" accept=".txt,.md,.markdown,.pdf" className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">
                PDF volumineux : l'indexation peut prendre 20–30 s. En cas d'échec, exportez en .txt.
              </p>
            </div>
            <div>
              <Label htmlFor="title">Titre (optionnel)</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Propale Banque 2024" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["propale", "reference", "offre", "methodo", "cr_rdv", "notion_page", "upload"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Secteur</Label>
                <Select value={sector || "_"} onValueChange={(v) => setSector(v === "_" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {SECTEURS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Résultat</Label>
              <Select value={outcome || "_"} onValueChange={(v) => setOutcome(v === "_" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">—</SelectItem>
                  <SelectItem value="won">won</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Indexation…" : "Indexer"}
            </Button>

            {/* Barre de progression */}
            {pollProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Indexation en cours…</span>
                  <span>{pollProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${pollProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Ne fermez pas la fenêtre — les PDF volumineux peuvent prendre 20–30 s.
                </p>
              </div>
            )}

            {/* Erreur délai dépassé */}
            {uploadError === "timeout" && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold">Délai dépassé</p>
                <p className="mt-1">L&apos;indexation a pris trop de temps. Essayez :</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>Exporter le PDF en <code>.txt</code> avant l&apos;envoi</li>
                  <li>Scinder le document en plusieurs parties</li>
                  <li>Supprimer <code>VOYAGE_EMBED_BATCH_DELAY_MS</code> si Voyage est actif</li>
                </ul>
                <button
                  onClick={() => setUploadError(null)}
                  className="mt-2 text-amber-700 underline"
                  type="button"
                >
                  Fermer
                </button>
              </div>
            )}
          </form>

          <h2 className="text-lg font-semibold">Indexer une page Notion</h2>
          <form onSubmit={onIngestNotion} className="space-y-3 rounded-md border p-4">
            <div>
              <Label htmlFor="notionUrl">URL ou ID de page Notion</Label>
              <Input
                id="notionUrl"
                value={notionUrl}
                onChange={(e) => setNotionUrl(e.target.value)}
                placeholder="https://www.notion.so/…"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                L&apos;intégration Notion doit avoir accès à la page (même token que les bases CRM).
              </p>
            </div>
            <div>
              <Label htmlFor="notionTitle">Titre (optionnel)</Label>
              <Input
                id="notionTitle"
                value={notionTitle}
                onChange={(e) => setNotionTitle(e.target.value)}
                placeholder="Sinon titre de la page Notion"
              />
            </div>
            <Button type="submit" disabled={ingestingNotion || !notionUrl.trim()}>
              {ingestingNotion ? "Extraction Notion…" : "Indexer depuis Notion"}
            </Button>
          </form>

          <h3 className="text-sm font-semibold text-muted-foreground">
            Documents indexés · {docs.length}
          </h3>
          <ul className="divide-y rounded-md border text-sm">
            {docs.length === 0 && (
              <li className="p-3 text-muted-foreground">Aucun document.</li>
            )}
            {docs.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.sourceType}
                    {d.sector ? ` · ${d.sector}` : ""}
                    {d.outcome ? ` · ${d.outcome}` : ""} · {d.chunkCount} chunks
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label={`Supprimer le document ${d.title}`}
                  onClick={() => setPendingDeleteId(d.id)}
                >
                  Suppr.
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recherche test (RAG)</h2>
          <form onSubmit={onSearch} className="flex flex-col gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex. références banque transformation digitale…"
            />
            <Select value={sectorFilter || "_"} onValueChange={(v) => setSectorFilter(v === "_" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Filtrer secteur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Tous secteurs</SelectItem>
                {SECTEURS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={searching}>
              {searching ? "Recherche…" : "Rechercher"}
            </Button>
          </form>

          <div className="space-y-2">
            {hits.map((h, i) => (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{h.doc.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {(h.similarity * 100).toFixed(0)} %
                  </span>
                </div>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                  {h.chunkText}
                </p>
              </div>
            ))}
            {hits.length === 0 && query && !searching && (
              <p className="text-sm text-muted-foreground">Aucun résultat.</p>
            )}
          </div>
        </section>
      </div>

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open && !deleting) setPendingDeleteId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce document ?</DialogTitle>
            <DialogDescription>
              <strong>{pendingDeleteTitle}</strong> sera retiré de l&apos;index vectoriel.
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDeleteId(null)}
              disabled={deleting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
