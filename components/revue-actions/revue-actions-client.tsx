"use client";

import * as React from "react";
import {
  CheckCircle2, Clock, XCircle, RefreshCw, ChevronRight, ChevronLeft,
  ClipboardCheck, ListChecks, Zap, Mail, Phone, Users, HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RecoResolveDialog } from "@/components/revue-actions/reco-resolve-dialog";

interface RevueAction {
  id: string;
  compte_id: string;
  compte_nom: string;
  action_text: string;
  target_contacts: string;
  linked_offer: string | null;
  horizon: string;
  generated_at: string;
  status: string;
  done_at: string | null;
  done_type: string | null;
  done_contact: string | null;
  done_notes: string | null;
}

type WizardStep =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "empty" }
  | { phase: "review"; actions: RevueAction[]; index: number }
  | { phase: "recording"; actions: RevueAction[]; index: number }
  | { phase: "done"; total: number; completed: number };

const HORIZON_COLORS: Record<string, string> = {
  "J+7":   "bg-red-100 text-red-700 border-red-200",
  "J+30":  "bg-amber-100 text-amber-700 border-amber-200",
  "J+90":  "bg-blue-100 text-blue-700 border-blue-200",
  "J+180": "bg-slate-100 text-slate-600 border-slate-200",
};

const DONE_TYPES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: "email",   label: "Email",   icon: Mail },
  { value: "appel",   label: "Appel",   icon: Phone },
  { value: "reunion", label: "Réunion", icon: Users },
  { value: "autre",   label: "Autre",   icon: HelpCircle },
];

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function RevueActionsClient() {
  const [step, setStep] = React.useState<WizardStep>({ phase: "idle" });
  const [syncing, setSyncing] = React.useState(false);
  const [doneType, setDoneType] = React.useState("email");
  const [doneContact, setDoneContact] = React.useState("");
  const [doneNotes, setDoneNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [completedCount, setCompletedCount] = React.useState(0);

  async function handleSync() {
    setSyncing(true);
    await fetch("/api/revue-actions", { method: "POST" });
    setSyncing(false);
    void startReview();
  }

  async function startReview() {
    setStep({ phase: "loading" });
    const res = await fetch("/api/revue-actions?status=pending");
    const data = (await res.json()) as { actions: RevueAction[] };
    const actions = data.actions ?? [];
    if (actions.length === 0) {
      setStep({ phase: "empty" });
    } else {
      setCompletedCount(0);
      setStep({ phase: "review", actions, index: 0 });
    }
  }

  function currentAction() {
    if (step.phase !== "review" && step.phase !== "recording") return null;
    return step.actions[step.index] ?? null;
  }

  function goNext(actions: RevueAction[], index: number) {
    const nextIndex = index + 1;
    if (nextIndex >= actions.length) {
      setStep({ phase: "done", total: actions.length, completed: completedCount });
    } else {
      setStep({ phase: "review", actions, index: nextIndex });
    }
  }

  async function handleSkip() {
    if (step.phase !== "review") return;
    const { actions, index } = step;
    const action = actions[index];
    await fetch(`/api/revue-actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    goNext(actions, index);
  }

  function handleStartRecording() {
    if (step.phase !== "review") return;
    const action = currentAction();
    setDoneContact(action?.target_contacts ?? "");
    setDoneNotes("");
    setDoneType("email");
    setStep({ phase: "recording", actions: step.actions, index: step.index });
  }

  async function handleConfirmDone() {
    if (step.phase !== "recording") return;
    setSubmitting(true);
    const { actions, index } = step;
    const action = actions[index];
    await fetch(`/api/revue-actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done", doneType, doneContact, doneNotes }),
    });
    setSubmitting(false);
    setCompletedCount((n) => n + 1);
    goNext(actions, index);
  }

  function handleCancelRecording() {
    if (step.phase !== "recording") return;
    setStep({ phase: "review", actions: step.actions, index: step.index });
  }

  const action = currentAction();
  const totalActions = step.phase === "review" || step.phase === "recording"
    ? step.actions.length : 0;
  const currentIndex = step.phase === "review" || step.phase === "recording"
    ? step.index : 0;

  /* ── Phase IDLE ───────────────────────────────────────────────── */
  if (step.phase === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <ClipboardCheck className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Revue des actions</h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Je passe en revue les actions que je t&apos;avais recommandées pour chaque compte —
            tu confirmes ce qui a été fait et tu renseignes les détails.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            Synchroniser depuis les analyses
          </Button>
          <Button onClick={() => void startReview()} className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Lancer la revue
          </Button>
        </div>
      </div>
    );
  }

  /* ── Phase LOADING ────────────────────────────────────────────── */
  if (step.phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chargement des actions…</p>
      </div>
    );
  }

  /* ── Phase EMPTY ──────────────────────────────────────────────── */
  if (step.phase === "empty") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-emerald-700">Tout est à jour !</p>
          <p className="text-sm text-muted-foreground mt-1">
            Aucune action en attente. Lance une synchronisation pour importer les dernières recommandations.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          Synchroniser
        </Button>
      </div>
    );
  }

  /* ── Phase DONE ───────────────────────────────────────────────── */
  if (step.phase === "done") {
    return (
      <div className="flex flex-col items-center gap-5 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
          <ListChecks className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">Revue terminée</p>
          <p className="text-sm text-muted-foreground mt-1">
            {step.completed} action{step.completed > 1 ? "s" : ""} enregistrée{step.completed > 1 ? "s" : ""} sur {step.total} passées en revue.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => setStep({ phase: "idle" })}>
            Retour
          </Button>
          <Button size="sm" onClick={() => void startReview()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Recommencer
          </Button>
        </div>
      </div>
    );
  }

  /* ── Phase REVIEW / RECORDING ─────────────────────────────────── */
  if (!action) return null;

  const age = daysSince(action.generated_at);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((currentIndex) / totalActions) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {currentIndex + 1} / {totalActions}
        </span>
      </div>

      {/* Carte action */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Header compte */}
        <div className="flex items-center gap-3 border-b bg-muted/30 px-5 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <span className="text-xs font-bold text-primary">
              {action.compte_nom.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{action.compte_nom}</p>
            <p className="text-[11px] text-muted-foreground">
              Recommandation générée il y a {age} jour{age > 1 ? "s" : ""}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-[11px] font-medium border", HORIZON_COLORS[action.horizon] ?? "bg-slate-100 text-slate-600")}
          >
            {action.horizon}
          </Badge>
        </div>

        {/* Corps */}
        <div className="px-5 py-5 space-y-4">
          {/* La question principale */}
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Action recommandée
            </p>
            <p className="text-base leading-snug font-medium">
              {action.action_text}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {action.target_contacts && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Contact(s)</p>
                <p className="text-sm">{action.target_contacts}</p>
              </div>
            )}
            {action.linked_offer && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Offre Sia</p>
                <p className="text-sm">{action.linked_offer}</p>
              </div>
            )}
          </div>

          {/* ── Mode RECORDING ── */}
          {step.phase === "recording" && (
            <div className="rounded-xl border bg-muted/20 p-4 space-y-4 mt-2">
              <p className="text-sm font-medium text-emerald-700">Super ! Précise comment :</p>

              {/* Type d'action */}
              <div className="grid grid-cols-4 gap-2">
                {DONE_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setDoneType(value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border py-2.5 px-1 text-xs font-medium transition-colors",
                      doneType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Contact effectif */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Contact (optionnel)</label>
                <input
                  value={doneContact}
                  onChange={(e) => setDoneContact(e.target.value)}
                  placeholder={action.target_contacts || "Nom du contact…"}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes / compte-rendu (optionnel)</label>
                <Textarea
                  value={doneNotes}
                  onChange={(e) => setDoneNotes(e.target.value)}
                  placeholder="Résumé de l'échange, retour du contact, prochaine étape…"
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleCancelRecording} className="flex-1">
                  Annuler
                </Button>
                <Button size="sm" onClick={() => void handleConfirmDone()} disabled={submitting} className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions — uniquement en mode review */}
        {step.phase === "review" && (
          <div className="border-t px-5 py-4">
            <p className="text-xs text-muted-foreground mb-3 text-center">
              As-tu effectué cette action ?
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSkip()}
                className="gap-1.5 text-muted-foreground"
              >
                <Clock className="h-3.5 w-3.5" />
                Pas encore
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSkip()}
                className="gap-1.5 text-muted-foreground border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                <XCircle className="h-3.5 w-3.5" />
                Pas pertinent
              </Button>
              <Button
                size="sm"
                onClick={handleStartRecording}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Oui, c&apos;est fait !
              </Button>
            </div>
            {action && (
              <div className="mt-2">
                <RecoResolveDialog
                  action={{
                    id: action.id,
                    compteId: action.compte_id,
                    compteNom: action.compte_nom,
                    actionText: action.action_text,
                    targetContacts: action.target_contacts ?? "",
                  }}
                  onResolved={() => {
                    setCompletedCount((n) => n + 1);
                    if (step.phase === "review") goNext(step.actions, step.index);
                  }}
                  trigger={
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Qualifier / résoudre (contacts)
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={currentIndex === 0 || step.phase === "recording"}
          onClick={() => {
            if (step.phase === "review") setStep({ phase: "review", actions: step.actions, index: step.index - 1 });
          }}
          className="gap-1 text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={step.phase === "recording"}
          onClick={() => {
            if (step.phase === "review") goNext(step.actions, step.index);
          }}
          className="gap-1 text-muted-foreground"
        >
          Passer
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
