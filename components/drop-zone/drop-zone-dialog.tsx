"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Loader2, User, Target, ListTodo, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseApiJson } from "@/lib/parse-api-json";
import { OPP_STAGES } from "@/lib/types";

type DropKind = "contact" | "opportunite" | "tache" | "note";

interface DropItem {
  kind: DropKind;
  label: string;
  fields: Record<string, string>;
  existingNom?: string;
  enabled: boolean;
}

interface CompteCandidate {
  id: string;
  compte: string;
}

const NONE = "__none";
const CREATE = "__create";

const KIND_META: Record<DropKind, { label: string; icon: React.ElementType; color: string }> = {
  contact: { label: "Contact", icon: User, color: "text-blue-600" },
  opportunite: { label: "Opportunité", icon: Target, color: "text-violet-600" },
  tache: { label: "Action / RDV", icon: ListTodo, color: "text-amber-600" },
  note: { label: "Note / CR", icon: FileText, color: "text-slate-600" },
};

export function DropZoneDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [analyzed, setAnalyzed] = React.useState(false);

  const [summary, setSummary] = React.useState("");
  const [items, setItems] = React.useState<DropItem[]>([]);
  const [candidates, setCandidates] = React.useState<CompteCandidate[]>([]);
  const [compteSel, setCompteSel] = React.useState<string>(NONE);
  const [compteQuery, setCompteQuery] = React.useState("");

  function reset() {
    setInput("");
    setAnalyzed(false);
    setSummary("");
    setItems([]);
    setCandidates([]);
    setCompteSel(NONE);
    setCompteQuery("");
  }

  function setItemField(i: number, k: string, v: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, fields: { ...it.fields, [k]: v } } : it)));
  }
  function toggleItem(i: number) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, enabled: !it.enabled } : it)));
  }

  async function analyze() {
    if (!input.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/drop-zone/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec de l'analyse.");

      const raw = (data.items as Omit<DropItem, "enabled">[]) ?? [];
      const cands = (data.compteCandidates as CompteCandidate[]) ?? [];
      const q = typeof data.compteQuery === "string" ? data.compteQuery : "";

      setSummary(typeof data.summary === "string" ? data.summary : "");
      setCompteQuery(q);
      setCandidates(cands);
      setCompteSel(cands.length > 0 ? cands[0].id : q ? CREATE : NONE);
      // Contacts déjà en base : décochés par défaut.
      setItems(raw.map((it) => ({ ...it, enabled: !it.existingNom })));
      setAnalyzed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function create() {
    const enabled = items.filter((it) => it.enabled);
    if (enabled.length === 0) {
      toast.error("Sélectionne au moins un objet.");
      return;
    }
    setCreating(true);
    try {
      const compteId = compteSel !== NONE && compteSel !== CREATE ? compteSel : "";
      const compteNom = candidates.find((c) => c.id === compteId)?.compte ?? "";
      const createCompteNom = compteSel === CREATE ? compteQuery : "";

      const res = await fetch("/api/drop-zone/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compteId,
          compteNom,
          createCompteNom,
          items: enabled.map((it) => ({ kind: it.kind, fields: it.fields })),
        }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec de la création.");

      const createdArr = (data.created as string[]) ?? [];
      const errs = (data.errors as string[]) ?? [];
      toast.success(`${createdArr.length} objet(s) créé(s)${errs.length ? ` · ${errs.length} échec(s)` : ""}.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setCreating(false);
    }
  }

  const enabledCount = items.filter((it) => it.enabled).length;
  const needsCompte = items.some((it) => it.enabled && it.kind !== "contact");
  const compteResolved =
    (compteSel !== NONE && compteSel !== CREATE) || (compteSel === CREATE && compteQuery.trim().length > 0);
  const compteMissing = needsCompte && !compteResolved;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button
        size="sm"
        className="gap-1.5 text-xs font-medium"
        onClick={() => setOpen(true)}
        style={{
          background: "linear-gradient(135deg, hsl(231 72% 40%) 0%, hsl(231 72% 32%) 100%)",
          border: "1px solid hsl(231 72% 32%)",
          color: "white",
        }}
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Capture</span>
      </Button>

      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Capture rapide
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ex : Omar Tounsi (Akwa Group) a communiqué nos coordonnées à sa N+1 Sanae Maddah, Chief Strategy Officer…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void analyze();
            }}
          />
          {!analyzed && (
            <Button onClick={() => void analyze()} disabled={analyzing || !input.trim()} className="w-full gap-1.5">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "Analyse…" : "Analyser"}
            </Button>
          )}

          {analyzed && (
            <div className="space-y-3">
              {summary && <p className="text-xs text-muted-foreground">{summary}</p>}

              {/* Rattachement compte (partagé) */}
              <div className="space-y-1 rounded-lg border bg-muted/20 p-2.5">
                <Label className="text-[11px]">
                  Compte {needsCompte && <span className="text-red-500">*</span>}
                </Label>
                <Select value={compteSel} onValueChange={setCompteSel}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Aucun compte</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.compte}</SelectItem>
                    ))}
                    {compteQuery && <SelectItem value={CREATE}>+ Créer « {compteQuery} »</SelectItem>}
                  </SelectContent>
                </Select>
                {compteSel === CREATE && (
                  <Input
                    value={compteQuery}
                    onChange={(e) => setCompteQuery(e.target.value)}
                    placeholder="Nom du compte à créer"
                    className="mt-1 h-9"
                  />
                )}
              </div>

              {/* Objets détectés */}
              {items.length === 0 ? (
                <p className="rounded-md border py-6 text-center text-sm text-muted-foreground">
                  Aucun objet détecté.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((it, i) => {
                    const Meta = KIND_META[it.kind];
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-xl border p-3 transition-opacity",
                          it.enabled ? "bg-white/70" : "bg-muted/30 opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={it.enabled}
                            onChange={() => toggleItem(i)}
                            className="mt-1 h-4 w-4 shrink-0 accent-primary"
                          />
                          <Meta.icon className={cn("mt-0.5 h-4 w-4 shrink-0", Meta.color)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">{Meta.label}</Badge>
                              {it.existingNom && (
                                <span className="flex items-center gap-1 text-[11px] text-amber-600">
                                  <AlertTriangle className="h-3 w-3" /> déjà en base — décoché
                                </span>
                              )}
                            </div>
                            {it.enabled && <ItemFields item={it} onField={(k, v) => setItemField(i, k, v)} />}
                            {!it.enabled && <p className="mt-1 text-xs text-muted-foreground">{it.label}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {compteMissing && (
                <p className="text-[11px] text-red-500">
                  Un compte est requis pour les opportunités, actions et notes.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={creating}>
            Annuler
          </Button>
          {analyzed && (
            <Button onClick={() => void create()} disabled={creating || enabledCount === 0 || compteMissing}>
              {creating ? "Création…" : `Créer (${enabledCount})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemFields({
  item,
  onField,
}: {
  item: DropItem;
  onField: (k: string, v: string) => void;
}) {
  const f = item.fields;
  if (item.kind === "contact") {
    return (
      <div className="mt-2 space-y-2">
        <FieldRow label="Nom complet" value={f.nomComplet} onChange={(v) => onField("nomComplet", v)} />
        <FieldRow label="Titre" value={f.titre} onChange={(v) => onField("titre", v)} />
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Email" value={f.email} onChange={(v) => onField("email", v)} />
          <FieldRow label="Téléphone" value={f.telephone} onChange={(v) => onField("telephone", v)} />
        </div>
        <FieldRow label="LinkedIn" value={f.linkedin} onChange={(v) => onField("linkedin", v)} />
      </div>
    );
  }
  if (item.kind === "opportunite") {
    return (
      <div className="mt-2 space-y-2">
        <FieldRow label="Opportunité" value={f.opportunite} onChange={(v) => onField("opportunite", v)} />
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="Montant (k€)" value={f.montant} onChange={(v) => onField("montant", v)} />
          <div className="space-y-1">
            <Label className="text-[11px]">Stage</Label>
            <Select value={f.stage || NONE} onValueChange={(v) => onField("stage", v === NONE ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {OPP_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <FieldRow label="Next step" value={f.nextStep} onChange={(v) => onField("nextStep", v)} />
      </div>
    );
  }
  if (item.kind === "tache") {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <FieldRow label="Intitulé" value={f.titre} onChange={(v) => onField("titre", v)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Type</Label>
          <Select value={f.type || "todo"} onValueChange={(v) => onField("type", v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Tâche</SelectItem>
              <SelectItem value="appel">Appel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Échéance</Label>
          <Input type="date" value={f.dueDate ?? ""} onChange={(e) => onField("dueDate", e.target.value)} className="h-9" />
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-1">
      <Label className="text-[11px]">Note / compte-rendu</Label>
      <Textarea value={f.texte ?? ""} onChange={(e) => onField("texte", e.target.value)} rows={2} />
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}
