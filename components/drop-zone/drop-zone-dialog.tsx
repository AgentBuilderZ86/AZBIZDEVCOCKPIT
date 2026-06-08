"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Loader2, User, Target, ListTodo, FileText } from "lucide-react";
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
import { parseApiJson } from "@/lib/parse-api-json";
import { OPP_STAGES } from "@/lib/types";

type DropType = "contact" | "opportunite" | "tache" | "note";

interface Classification {
  type: DropType;
  confidence: number;
  summary: string;
  compteQuery: string;
  contact: Record<string, string> | null;
  opportunite: Record<string, unknown> | null;
  tache: Record<string, string> | null;
  note: { texte: string } | null;
}

interface CompteCandidate {
  id: string;
  compte: string;
}

const NONE = "__none";
const CREATE = "__create";

const TYPE_META: Record<DropType, { label: string; icon: React.ElementType }> = {
  contact: { label: "Contact", icon: User },
  opportunite: { label: "Opportunité", icon: Target },
  tache: { label: "Action / RDV", icon: ListTodo },
  note: { label: "Note / CR", icon: FileText },
};

export function DropZoneDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [type, setType] = React.useState<DropType>("contact");
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [candidates, setCandidates] = React.useState<CompteCandidate[]>([]);
  const [compteSel, setCompteSel] = React.useState<string>(NONE);
  const [compteQuery, setCompteQuery] = React.useState("");
  const [analyzed, setAnalyzed] = React.useState(false);

  function reset() {
    setInput("");
    setAnalyzed(false);
    setFields({});
    setCandidates([]);
    setCompteSel(NONE);
    setCompteQuery("");
  }

  function setField(k: string, v: string) {
    setFields((p) => ({ ...p, [k]: v }));
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

      const c = data.classification as Classification;
      const cands = (data.compteCandidates as CompteCandidate[]) ?? [];
      setType(c.type);
      setCompteQuery(c.compteQuery ?? "");
      setCandidates(cands);
      setCompteSel(cands.length > 0 ? cands[0].id : c.compteQuery ? CREATE : NONE);

      // Pré-remplir les champs éditables selon le type
      if (c.type === "contact" && c.contact) {
        setFields({
          nomComplet: c.contact.nomComplet ?? "",
          titre: c.contact.titre ?? "",
          email: c.contact.email ?? "",
          linkedin: c.contact.linkedin ?? "",
          telephone: c.contact.telephone ?? "",
        });
      } else if (c.type === "opportunite" && c.opportunite) {
        const o = c.opportunite;
        setFields({
          opportunite: String(o.opportunite ?? ""),
          montant: o.montant != null ? String(o.montant) : "",
          stage: typeof o.stage === "string" ? o.stage : "",
          nextStep: String(o.nextStep ?? ""),
        });
      } else if (c.type === "tache" && c.tache) {
        setFields({
          titre: c.tache.titre ?? "",
          type: c.tache.type ?? "todo",
          dueDate: c.tache.dueDate ?? "",
        });
      } else if (c.type === "note" && c.note) {
        setFields({ texte: c.note.texte ?? "" });
      }
      setAnalyzed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function create() {
    setCreating(true);
    try {
      const compteId = compteSel !== NONE && compteSel !== CREATE ? compteSel : "";
      const compteNom = candidates.find((c) => c.id === compteId)?.compte ?? "";
      const createCompteNom = compteSel === CREATE ? compteQuery : "";

      const payload: Record<string, unknown> = { ...fields };
      if (type === "opportunite") {
        const m = parseFloat(fields.montant ?? "");
        payload.montant = Number.isFinite(m) ? m : null;
      }

      const res = await fetch("/api/drop-zone/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, compteId, compteNom, createCompteNom, payload }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec de la création.");

      toast.success(`${TYPE_META[type].label} créé.`);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setCreating(false);
    }
  }

  const compteRequired = type !== "contact";
  const compteMissing =
    compteRequired &&
    (compteSel === NONE || (compteSel === CREATE && !compteQuery.trim()));

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

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
            placeholder="Ex : Merieme El Alaoui, DSI Label'Vie · Refonte data BCP 200k€ · Rappeler M. Alami demain · CR réunion…"
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
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              {/* Type détecté */}
              <div className="space-y-1">
                <Label className="text-[11px]">Type détecté</Label>
                <Select value={type} onValueChange={(v) => setType(v as DropType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_META) as DropType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Champs selon le type */}
              {type === "contact" && (
                <>
                  <FieldRow label="Nom complet" value={fields.nomComplet} onChange={(v) => setField("nomComplet", v)} />
                  <FieldRow label="Titre" value={fields.titre} onChange={(v) => setField("titre", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Email" value={fields.email} onChange={(v) => setField("email", v)} />
                    <FieldRow label="Téléphone" value={fields.telephone} onChange={(v) => setField("telephone", v)} />
                  </div>
                  <FieldRow label="LinkedIn" value={fields.linkedin} onChange={(v) => setField("linkedin", v)} />
                </>
              )}
              {type === "opportunite" && (
                <>
                  <FieldRow label="Opportunité" value={fields.opportunite} onChange={(v) => setField("opportunite", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Montant (k€)" value={fields.montant} onChange={(v) => setField("montant", v)} />
                    <div className="space-y-1">
                      <Label className="text-[11px]">Stage</Label>
                      <Select value={fields.stage || NONE} onValueChange={(v) => setField("stage", v === NONE ? "" : v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {OPP_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <FieldRow label="Next step" value={fields.nextStep} onChange={(v) => setField("nextStep", v)} />
                </>
              )}
              {type === "tache" && (
                <>
                  <FieldRow label="Intitulé" value={fields.titre} onChange={(v) => setField("titre", v)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Type</Label>
                      <Select value={fields.type || "todo"} onValueChange={(v) => setField("type", v)}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Tâche</SelectItem>
                          <SelectItem value="appel">Appel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Échéance</Label>
                      <Input type="date" value={fields.dueDate ?? ""} onChange={(e) => setField("dueDate", e.target.value)} className="h-9" />
                    </div>
                  </div>
                </>
              )}
              {type === "note" && (
                <div className="space-y-1">
                  <Label className="text-[11px]">Note / compte-rendu</Label>
                  <Textarea value={fields.texte ?? ""} onChange={(e) => setField("texte", e.target.value)} rows={3} />
                </div>
              )}

              {/* Rattachement compte */}
              <div className="space-y-1">
                <Label className="text-[11px]">
                  Compte {compteRequired && <span className="text-red-500">*</span>}
                </Label>
                <Select value={compteSel} onValueChange={setCompteSel}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {!compteRequired && <SelectItem value={NONE}>Aucun compte</SelectItem>}
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.compte}</SelectItem>
                    ))}
                    {compteQuery && (
                      <SelectItem value={CREATE}>+ Créer « {compteQuery} »</SelectItem>
                    )}
                    {compteRequired && candidates.length === 0 && !compteQuery && (
                      <SelectItem value={NONE} disabled>Aucun compte trouvé</SelectItem>
                    )}
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

              <Badge variant="outline" className="text-[10px]">
                {TYPE_META[type].label}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }} disabled={creating}>
            Annuler
          </Button>
          {analyzed && (
            <Button onClick={() => void create()} disabled={creating || compteMissing}>
              {creating ? "Création…" : "Créer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
