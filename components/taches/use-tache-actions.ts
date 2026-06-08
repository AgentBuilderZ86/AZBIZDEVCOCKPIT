"use client";

import { toast } from "sonner";
import { parseApiJson } from "@/lib/parse-api-json";
import type { TacheRow, TacheStatus } from "@/lib/types";

/**
 * Logique partagée de mutation des tâches (optimiste + rollback).
 * `items`/`setItems` proviennent du parent (source de vérité unique).
 */
export function useTacheActions(
  items: TacheRow[],
  setItems: (next: TacheRow[]) => void
) {
  async function setStatus(id: string, status: TacheStatus) {
    const prev = items;
    setItems(
      items.map((t) =>
        t.id === id
          ? { ...t, status, done_at: status === "done" ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      const res = await fetch(`/api/taches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
      setItems(prev);
    }
  }

  async function remove(id: string) {
    const prev = items;
    setItems(items.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/taches/${id}`, { method: "DELETE" });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Échec.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau.");
      setItems(prev);
    }
  }

  return { setStatus, remove };
}
