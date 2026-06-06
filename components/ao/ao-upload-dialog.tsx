"use client";

import * as React from "react";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Props {
  onImported: () => void;
}

type UploadState =
  | { step: "idle" }
  | { step: "parsing"; fileName: string }
  | { step: "uploading"; fileName: string }
  | { step: "qualifying"; fileName: string; jobId: string; count: number }
  | { step: "done"; count: number }
  | { step: "error"; message: string };

export function AoUploadDialog({ onImported }: Props) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<UploadState>({ step: "idle" });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  React.useEffect(() => () => stopPolling(), []);

  async function handleFile(file: File) {
    setState({ step: "uploading", fileName: file.name });

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/ao/upload", { method: "POST", body: form });
    const data = (await res.json()) as Record<string, unknown>;

    if (!res.ok || !data.ok) {
      setState({ step: "error", message: typeof data.error === "string" ? data.error : "Erreur d'import." });
      return;
    }

    const count = typeof data.count === "number" ? data.count : 0;
    const jobId = typeof data.jobId === "string" ? data.jobId : null;

    if (!jobId) {
      setState({ step: "done", count });
      onImported();
      return;
    }

    setState({ step: "qualifying", fileName: file.name, jobId, count });

    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/intelligence/jobs/${jobId}`);
        const d = (await r.json()) as Record<string, unknown>;
        const job = d.job as { status: string } | undefined;
        if (!job) return;
        if (job.status === "done" || job.status === "failed") {
          stopPolling();
          setState({ step: "done", count });
          onImported();
        }
      } catch {
        stopPolling();
        setState({ step: "done", count });
        onImported();
      }
    }, 3000);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleClose() {
    stopPolling();
    setOpen(false);
    setTimeout(() => setState({ step: "idle" }), 300);
  }

  const isLoading = state.step === "uploading" || state.step === "qualifying" || state.step === "parsing";

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => { setState({ step: "idle" }); setOpen(true); }}>
        <Upload className="h-3.5 w-3.5" />
        Importer
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Importer des AOs</DialogTitle>
          </DialogHeader>

          {state.step === "idle" && (
            <div
              className="mt-2 flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-8 transition-colors hover:border-primary/40 hover:bg-primary/[0.02] cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Glisser le fichier ici ou cliquer</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Excel (.xlsx, .xls) ou CSV · max 5 Mo</p>
              </div>
              <p className="text-[10px] text-muted-foreground/70 text-center max-w-xs">
                Colonnes reconnues automatiquement : Titre, Client, Deadline, Budget, Description, URL, Secteur
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleChange}
              />
            </div>
          )}

          {(state.step === "uploading" || state.step === "parsing") && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Import en cours…</p>
              <p className="text-xs text-muted-foreground">{"fileName" in state ? state.fileName : ""}</p>
            </div>
          )}

          {state.step === "qualifying" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
              <p className="text-sm font-medium">{state.count} AOs importés</p>
              <p className="text-xs text-muted-foreground">Qualification IA en cours…</p>
              <p className="text-[10px] text-muted-foreground/60">Calcul des scores de fit et synthèses</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => {
                stopPolling();
                setState({ step: "done", count: state.count });
                onImported();
              }}>
                Passer · voir résultats maintenant
              </Button>
            </div>
          )}

          {state.step === "done" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-emerald-700">{state.count} AOs importés</p>
              <p className="text-xs text-muted-foreground">Scores et synthèses disponibles dans le tableau.</p>
              <Button size="sm" onClick={handleClose}>Voir les AOs</Button>
            </div>
          )}

          {state.step === "error" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <p className="text-sm font-semibold text-red-700">Erreur d&apos;import</p>
              <p className={cn("text-xs text-center text-muted-foreground max-w-xs")}>{state.message}</p>
              <Button variant="outline" size="sm" onClick={() => setState({ step: "idle" })}>Réessayer</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
