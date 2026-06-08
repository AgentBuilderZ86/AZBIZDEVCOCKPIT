"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseApiJson } from "@/lib/parse-api-json";
import type { TacheScope, TacheStatus, TacheRow } from "@/lib/types";

export interface TacheTarget {
  scope: TacheScope;
  cibleId: string | null;
  cibleNom: string;
}

interface Props {
  compteId: string;
  compteNom: string;
  /** Pré-remplit le rattachement (contact ou opportunité). Défaut : le compte. */
  target?: TacheTarget;
  /** Déclencheur custom ; sinon un bouton « + Tâche » par défaut. */
  trigger?: React.ReactNode;
  /** Appelé après création réussie (la ligne créée est passée). */
  onCreated?: (tache: TacheRow) => void;
}

export function TacheForm({ compteId, compteNom, target, trigger, onCreated }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [type, setType] = React.useState<"todo" | "appel">("todo");
  const [titre, setTitre] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [priorite, setPriorite] = React.useState<"haute" | "moyenne" | "basse">("moyenne");
  const [status, setStatus] = React.useState<TacheStatus>("pending");
  const [notes, setNotes] = React.useState("");

  function reset() {
    setType("todo");
    setTitre("");
    setDueDate("");
    setPriorite("moyenne");
    setStatus("pending");
    setNotes("");
  }

  async function submit() {
    if (!titre.trim()) {
      toast.error("Indiquez un intitulé.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/taches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          compteId,
          compteNom,
          scope: target?.scope ?? "compte",
          cibleId: target?.cibleId ?? null,
          cibleNom: target?.cibleNom ?? "",
          type,
          titre,
          notes,
          priorite,
          status,
          dueDate: dueDate || null,
        }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec de l'ajout.");

      toast.success(type === "appel" ? "Appel ajouté." : "Tâche ajoutée.");
      const created = data.tache as TacheRow | undefined;
      if (created && onCreated) onCreated(created);
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8">
            <Plus className="h-3.5 w-3.5" /> Tâche
          </Button>
        )}
      </span>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Nouvelle tâche
            {target && target.cibleNom ? (
              <span className="ml-1 font-normal text-muted-foreground">· {target.cibleNom}</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "todo" | "appel")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Tâche</SelectItem>
                  <SelectItem value="appel">Appel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Priorité</Label>
              <Select value={priorite} onValueChange={(v) => setPriorite(v as "haute" | "moyenne" | "basse")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="haute">Haute</SelectItem>
                  <SelectItem value="moyenne">Moyenne</SelectItem>
                  <SelectItem value="basse">Basse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Intitulé</Label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={type === "appel" ? "Rappeler pour…" : "À faire…"}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TacheStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Fait</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
