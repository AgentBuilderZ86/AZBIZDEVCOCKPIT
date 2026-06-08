"use client";

import * as React from "react";
import { Trash2, Phone, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TacheRow, TacheStatus } from "@/lib/types";

const PRIORITE_COLORS: Record<string, string> = {
  haute: "bg-red-100 text-red-700 border-red-200",
  moyenne: "bg-amber-100 text-amber-700 border-amber-200",
  basse: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_DOT: Record<TacheStatus, string> = {
  pending: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

function daysUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

interface Props {
  taches: TacheRow[];
  onSetStatus: (id: string, status: TacheStatus) => void;
  onDelete: (id: string) => void;
  emptyLabel?: string;
}

export function TachesList({ taches, onSetStatus, onDelete, emptyLabel = "Aucune tâche." }: Props) {
  if (taches.length === 0) {
    return (
      <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {taches.map((t) => {
        const isDone = t.status === "done";
        const overdue = !isDone && t.due_date != null && daysUntil(t.due_date) < 0;
        const soon =
          !isDone && t.due_date != null && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) < 7;
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              isDone
                ? "bg-emerald-50/30 opacity-70"
                : overdue
                  ? "border-red-200 bg-red-50/40"
                  : "bg-white/60"
            )}
          >
            <span className="mt-1 shrink-0">
              <span className={cn("inline-block h-2 w-2 rounded-full", STATUS_DOT[t.status])} />
            </span>
            <span className="mt-0.5 shrink-0 text-muted-foreground">
              {t.type === "appel" ? <Phone className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium leading-snug", isDone && "line-through text-muted-foreground")}>
                {t.titre}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="outline" className={cn("border", PRIORITE_COLORS[t.priorite] ?? "")}>
                  {t.priorite}
                </Badge>
                {t.cible_nom && <span className="text-muted-foreground">→ {t.cible_nom}</span>}
                {t.compte_nom && <span className="text-muted-foreground/60">{t.compte_nom}</span>}
                {t.due_date && (
                  <span
                    className={cn(
                      overdue
                        ? "font-medium text-red-600"
                        : soon
                          ? "font-medium text-orange-600"
                          : "text-muted-foreground"
                    )}
                  >
                    {overdue ? "En retard · " : ""}
                    {fmtDate(t.due_date)}
                  </span>
                )}
              </div>
              {t.notes && (
                <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-2">{t.notes}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Select value={t.status} onValueChange={(v) => onSetStatus(t.id, v as TacheStatus)}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Fait</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground"
                title="Supprimer"
                onClick={() => onDelete(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
