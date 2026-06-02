"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_FIELDS } from "@/lib/compte-ui";
import type { Compte, CompteCreate } from "@/lib/types";

interface Props {
  onCreated: (compte: Compte) => void;
}

const NONE = "__none__";

export function NewCompteDialog({ onCreated }: Props) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<CompteCreate>({ compte: "" });

  function reset() {
    setForm({ compte: "" });
  }

  async function submit() {
    if (!form.compte.trim()) {
      toast.error("Le nom du compte est requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/comptes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de la création.");
      onCreated(data.compte as Compte);
      toast.success(`Compte « ${data.compte.compte} » créé dans Notion.`);
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur création.");
    } finally {
      setSaving(false);
    }
  }

  const selectFields: Array<keyof typeof SELECT_FIELDS> = [
    "secteur",
    "priorite",
    "stage",
    "statutRelation",
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Nouveau compte
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau compte</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="compte">Compte *</Label>
            <Input
              id="compte"
              value={form.compte}
              onChange={(e) => setForm({ ...form, compte: e.target.value })}
              placeholder="Nom de l'organisation"
            />
          </div>
          {selectFields.map((field) => (
            <div className="grid gap-2" key={field}>
              <Label>{SELECT_FIELDS[field].label}</Label>
              <Select
                value={(form[field] as string) ?? NONE}
                onValueChange={(v) =>
                  setForm({ ...form, [field]: v === NONE ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {SELECT_FIELDS[field].options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
