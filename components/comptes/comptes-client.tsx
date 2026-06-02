"use client";

import * as React from "react";
import { toast } from "sonner";
import { FiltersBar, type FilterState } from "./filters-bar";
import { ComptesTable } from "./comptes-table";
import { BoardView } from "./board-view";
import { NewCompteDialog } from "./new-compte-dialog";
import type { Compte, CompteUpdate } from "@/lib/types";

interface Props {
  initial: Compte[];
}

const EMPTY_FILTERS: FilterState = {
  secteur: "",
  priorite: "",
  stage: "",
  statutRelation: "",
};

export function ComptesClient({ initial }: Props) {
  const [comptes, setComptes] = React.useState<Compte[]>(initial);
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
  const [view, setView] = React.useState<"table" | "board">("table");

  /** Optimistic update + write-back Notion + rollback en cas d'échec. */
  const onUpdate = React.useCallback(
    async (id: string, patch: CompteUpdate) => {
      const before = comptes.find((c) => c.id === id);
      if (!before) return;

      setComptes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
      );

      try {
        const res = await fetch(`/api/comptes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Échec de la mise à jour.");
        // Reconcilie avec la version serveur (valeurs normalisées par Notion).
        setComptes((prev) =>
          prev.map((c) => (c.id === id ? (data.compte as Compte) : c))
        );
        toast.success("Enregistré dans Notion.");
      } catch (err) {
        // Rollback.
        setComptes((prev) => prev.map((c) => (c.id === id ? before : c)));
        toast.error(
          err instanceof Error ? err.message : "Erreur d'écriture Notion."
        );
      }
    },
    [comptes]
  );

  const onArchive = React.useCallback(async (id: string) => {
    const before = comptes.find((c) => c.id === id);
    if (!before) return;
    setComptes((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, statutRelation: "Dormante" } : c
      )
    );
    try {
      const res = await fetch(`/api/comptes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "archive" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de l'archivage.");
      setComptes((prev) =>
        prev.map((c) => (c.id === id ? (data.compte as Compte) : c))
      );
      toast.success("Compte archivé (Dormante).");
    } catch (err) {
      setComptes((prev) => prev.map((c) => (c.id === id ? before : c)));
      toast.error(err instanceof Error ? err.message : "Erreur d'archivage.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comptes]);

  const onCreated = React.useCallback((compte: Compte) => {
    setComptes((prev) => [compte, ...prev]);
  }, []);

  const filtered = React.useMemo(() => {
    return comptes.filter((c) => {
      if (filters.secteur && c.secteur !== filters.secteur) return false;
      if (filters.priorite && c.priorite !== filters.priorite) return false;
      if (filters.stage && c.stage !== filters.stage) return false;
      if (filters.statutRelation && c.statutRelation !== filters.statutRelation)
        return false;
      return true;
    });
  }, [comptes, filters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <FiltersBar
          filters={filters}
          onChange={setFilters}
          view={view}
          onViewChange={setView}
          count={filtered.length}
        />
        <NewCompteDialog onCreated={onCreated} />
      </div>

      {view === "table" ? (
        <ComptesTable comptes={filtered} onUpdate={onUpdate} onArchive={onArchive} />
      ) : (
        <BoardView comptes={filtered} onUpdate={onUpdate} onArchive={onArchive} />
      )}
    </div>
  );
}
