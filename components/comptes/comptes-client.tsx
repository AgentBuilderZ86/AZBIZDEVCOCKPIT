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
import { cn } from "@/lib/utils";
import type { Compte, CompteUpdate } from "@/lib/types";

const CATEGORIES = [
  { value: "", label: "Tous" },
  { value: "Core Advisory", label: "🎯 Core Advisory" },
  { value: "Cross-sell", label: "🤝 Cross-sell" },
  { value: "Positionné", label: "📌 Positionné" },
  { value: "Watchlist", label: "👁 Watchlist" },
] as const;

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
  const [categoryFilter, setCategoryFilter] = React.useState("");
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
      if (categoryFilter && c.categorie !== categoryFilter) return false;
      if (filters.secteur && c.secteur !== filters.secteur) return false;
      if (filters.priorite && c.priorite !== filters.priorite) return false;
      if (filters.stage && c.stage !== filters.stage) return false;
      if (filters.statutRelation && c.statutRelation !== filters.statutRelation)
        return false;
      return true;
    });
  }, [comptes, filters, categoryFilter]);

  const pendingCompteName = pendingArchiveId
    ? comptes.find((c) => c.id === pendingArchiveId)?.compte ?? "ce compte"
    : null;

  return (
    <div className="space-y-4">
      {/* Category tab bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = comptes.filter(c => cat.value === "" ? true : c.categorie === cat.value).length;
          const isActive = categoryFilter === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat.label}
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", isActive ? "bg-white/20" : "bg-background/60")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

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
