"use client";

import * as React from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseApiJson } from "@/lib/parse-api-json";

/**
 * Lance la recherche « Référencement Achats » en masse sur tous les comptes.
 * Les jobs sont traités en arrière-plan ; consulter chaque fiche compte pour le résultat.
 */
export function ProcurementRunAllButton() {
  const [running, setRunning] = React.useState(false);

  async function runAll() {
    setRunning(true);
    try {
      const res = await fetch("/api/procurement/run-all", { method: "POST" });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(String(data.error ?? "Échec du lancement."));
      const enqueued = Number(data.enqueued ?? 0);
      toast.success(
        enqueued > 0
          ? `${enqueued} compte(s) en file. Résultats sur chaque fiche d'ici quelques minutes.`
          : "Recherche déjà lancée aujourd'hui pour tous les comptes."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur traitement en masse.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={runAll} disabled={running} className="gap-1.5">
      <ShoppingCart className={running ? "h-3.5 w-3.5 animate-pulse" : "h-3.5 w-3.5"} />
      {running ? "Lancement…" : "Référencement Achats — Tout traiter"}
    </Button>
  );
}
