"use client";

import * as React from "react";
import { toast } from "sonner";
import { FiltersBar, type FilterState } from "./filters-bar";
import { ComptesTable } from "./comptes-table";
import { BoardView } from "./board-view";
import { NewCompteDialog } from "./new-compte-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const [pendingArchiveId, setPendingArchiveId] = React.useState<string | null>(null);
  const [archiving, setArchiving] = React.useState(false);

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

  /** Demande de confirmation avant archivage. */
  const onArchiveRequest = React.useCallback(async (id: string) => {
    setPendingArchiveId(id);
  }, []);

  /** Exécute l'archivage après confirmation. */
  const confirmArchive = React.useCallback(async () => {
    const id = pendingArchiveId;
    if (!id) return;
    const before = comptes.find((c) => c.id === id);
    if (!before) return;

    setArchiving(true);
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
    } finally {
      setArchiving(false);
      setPendingArchiveId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingArchiveId, comptes]);

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

  const pendingCompteName = pendingArchiveId
    ? comptes.find((c) => c.id === pendingArchiveId)?.compte ?? "ce compte"
    : null;

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
        <ComptesTable comptes={filtered} onUpdate={onUpdate} onArchive={onArchiveRequest} />
      ) : (
        <BoardView comptes={filtered} onUpdate={onUpdate} onArchive={onArchiveRequest} />
      )}

      {/* Dialog de confirmation d'archivage */}
      <Dialog
        open={pendingArchiveId !== null}
        onOpenChange={(open) => { if (!open && !archiving) setPendingArchiveId(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archiver ce compte ?</DialogTitle>
            <DialogDescription>
              <strong>{pendingCompteName}</strong> sera marqué comme{" "}
              <em>Dormante</em> dans Notion. Vous pouvez modifier le statut
              manuellement pour annuler l&apos;opération.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingArchiveId(null)}
              disabled={archiving}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmArchive}
              disabled={archiving}
            >
              {archiving ? "Archivage…" : "Archiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
