"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, CornerDownLeft, Loader2, ArrowRight, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseApiJson } from "@/lib/parse-api-json";

interface CopilotResult {
  answer: string;
  accounts: { id: string; nom: string }[];
  suggestions: string[];
  usedRag: boolean;
}

const SUGGESTIONS = [
  "Quels comptes relancer en priorité cette semaine ?",
  "Quels sujets montent dans mon portefeuille ?",
  "Prépare un angle d'approche pour mon compte le plus chaud",
  "Où sont mes opportunités dormantes à réactiver ?",
];

/** Rendu markdown-léger sûr (gras + puces), sans injection HTML. */
function renderBold(s: string, keyPrefix: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={keyPrefix + i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={keyPrefix + i}>{p}</React.Fragment>
    )
  );
}
function renderAnswer(text: string) {
  return text.split(/\n/).map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    const bullet = /^\s*[-•*]\s+/.test(line);
    const heading = /^#{1,3}\s+/.test(line);
    const content = line.replace(/^\s*[-•*]\s+/, "").replace(/^#{1,3}\s+/, "");
    if (heading) return <p key={i} className="mt-2 font-display text-sm font-bold text-foreground">{renderBold(content, `h${i}`)}</p>;
    if (bullet)
      return (
        <p key={i} className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
          <span>{renderBold(content, `b${i}`)}</span>
        </p>
      );
    return <p key={i}>{renderBold(content, `p${i}`)}</p>;
  });
}

export function CopilotCommand() {
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<CopilotResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Ouverture ⌘K / Ctrl+K
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function ask(q: string) {
    const query = q.trim();
    if (query.length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur copilote.");
      setResult(data as unknown as CopilotResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuestion("");
    setResult(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex h-8 items-center gap-2 rounded-lg border border-border/70 bg-card/50 px-2.5 text-xs text-muted-foreground backdrop-blur-sm transition-all hover:border-primary/40 hover:text-foreground"
        aria-label="Copilote IA"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="hidden lg:inline">Demander à l&apos;IA</span>
        <kbd className="hidden rounded border border-border/70 bg-muted/60 px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border/60 px-4 py-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-aurora-gradient">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </span>
              Copilote <span className="text-gradient">Portefeuille</span>
            </DialogTitle>
          </DialogHeader>

          {/* Champ question */}
          <form
            onSubmit={(e) => { e.preventDefault(); void ask(question); }}
            className="flex items-center gap-2 border-b border-border/60 px-4 py-3"
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Demande-moi n'importe quoi sur ton portefeuille…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button type="submit" disabled={loading || question.trim().length < 3}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary disabled:opacity-40">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CornerDownLeft className="h-3.5 w-3.5" />}
            </button>
          </form>

          <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
            {/* État initial : suggestions */}
            {!result && !loading && !error && (
              <div className="space-y-2">
                <p className="label-muted">Suggestions</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuestion(s); void ask(s); }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-left text-sm text-foreground transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    {s}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Le copilote analyse ton portefeuille…
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="space-y-1.5 text-sm leading-relaxed text-foreground/90">
                  {renderAnswer(result.answer)}
                </div>

                {result.accounts.length > 0 && (
                  <div>
                    <p className="label-muted mb-1.5">Comptes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.accounts.map((a) => (
                        <Link
                          key={a.id}
                          href={`/compte/${a.id}`}
                          onClick={() => setOpen(false)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-xs text-foreground transition-all hover:border-primary/40 hover:text-primary"
                        >
                          <Building2 className="h-3 w-3" /> {a.nom}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {result.suggestions.length > 0 && (
                  <div>
                    <p className="label-muted mb-1.5">Pour aller plus loin</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setQuestion(s); void ask(s); }}
                          className="rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!result.usedRag && (
                  <p className="text-[11px] text-muted-foreground/60">
                    Réponse basée sur les données du portefeuille (RAG documentaire non interrogé).
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
