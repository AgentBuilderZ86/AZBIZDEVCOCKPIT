"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  compteId: string;
  initial: string;
}

/** Bloc Plan stratégique éditable (write-back via PATCH /api/comptes/[id]). */
export function PlanBlock({ compteId, initial }: Props) {
  const [value, setValue] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = value !== saved;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/comptes/${compteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planStrategique: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de l'enregistrement.");
      setSaved(value);
      toast.success("Plan stratégique enregistré dans Notion.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'écriture.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={12}
        placeholder="Enjeux, parties prenantes, offres Sia pertinentes, séquence d'approche, prochaines étapes…"
        className="min-h-[260px] text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="text-xs text-muted-foreground">Modifié</span>}
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
