"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, ArrowDown, ArrowUp, ExternalLink, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SelectCell, TextCell } from "./inline-cell";
import { PlanStrategiqueEditor } from "./plan-strategique-editor";
import { sortComptes, type SortKey } from "@/lib/compte-ui";
import type { Compte, CompteUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

function getCategoryStyle(categorie: string | null | undefined) {
  switch (categorie) {
    case "Core Advisory": return { border: "border-l-blue-500", bg: "bg-blue-50/20", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500" };
    case "Cross-sell":    return { border: "border-l-emerald-500", bg: "bg-emerald-50/15", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" };
    case "Positionné":    return { border: "border-l-amber-500", bg: "bg-amber-50/20", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" };
    case "Watchlist":     return { border: "border-l-gray-300", bg: "", badge: "bg-gray-100 text-gray-500", dot: "bg-gray-400" };
    default:              return { border: "border-l-transparent", bg: "", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/30" };
  }
}

function getCategoryLabel(categorie: string | null | undefined) {
  switch (categorie) {
    case "Core Advisory": return "🎯";
    case "Cross-sell":    return "🤝";
    case "Positionné":    return "📌";
    case "Watchlist":     return "👁";
    default:              return null;
  }
}

interface Props {
  comptes: Compte[];
  onUpdate: (id: string, patch: CompteUpdate) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

const COLUMNS: Array<{ key: SortKey; label: string; align?: "right" }> = [
  { key: "compte", label: "Compte" },
  { key: "secteur", label: "Secteur" },
  { key: "priorite", label: "Priorité" },
  { key: "stage", label: "Stage" },
  { key: "statutRelation", label: "Statut relation" },
  { key: "scoreAdilStar", label: "Score", align: "right" },
  { key: "arrPondere", label: "ARR (k€)", align: "right" },
];

export function ComptesTable({ comptes, onUpdate, onArchive }: Props) {
  const [sortKey, setSortKey] = React.useState<SortKey>("compte");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const sorted = React.useMemo(
    () => sortComptes(comptes, sortKey, sortDir),
    [comptes, sortKey, sortDir]
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-1">
    <div className="rounded-xl border bg-white/70 backdrop-blur-sm overflow-hidden" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05), inset 0 1px 0 hsl(0 0% 100% / 0.7)" }}>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.key}
                className={cn("cursor-pointer select-none", col.align === "right" && "text-right")}
                onClick={() => toggleSort(col.key)}
              >
                <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                  {col.label}
                  {sortKey === col.key &&
                    (sortDir === "asc" ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    ))}
                </span>
              </TableHead>
            ))}
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 2} className="h-24 text-center text-muted-foreground">
                Aucun compte.
              </TableCell>
            </TableRow>
          )}
          {sorted.map((c) => {
            const catStyle = getCategoryStyle(c.categorie);
            return (
            <TableRow key={c.id} className={cn("group transition-colors duration-150 hover:bg-primary/[0.025] border-l-4", catStyle.border, catStyle.bg)}>
              <TableCell className="min-w-[200px] font-medium">
                <div className="flex items-center gap-2">
                  {getCategoryLabel(c.categorie) && (
                    <span className="text-sm shrink-0" title={c.categorie ?? ""}>
                      {getCategoryLabel(c.categorie)}
                    </span>
                  )}
                  <TextCell
                    value={c.compte}
                    onSave={(v) => onUpdate(c.id, { compte: String(v) })}
                  />
                </div>
              </TableCell>
              <TableCell className="min-w-[150px]">
                <SelectCell
                  field="secteur"
                  value={c.secteur}
                  onSave={(v) => onUpdate(c.id, { secteur: v as Compte["secteur"] })}
                />
              </TableCell>
              <TableCell className="min-w-[130px]">
                <SelectCell
                  field="priorite"
                  value={c.priorite}
                  onSave={(v) => onUpdate(c.id, { priorite: v as Compte["priorite"] })}
                />
              </TableCell>
              <TableCell className="min-w-[110px]">
                <SelectCell
                  field="stage"
                  value={c.stage}
                  onSave={(v) => onUpdate(c.id, { stage: v as Compte["stage"] })}
                />
              </TableCell>
              <TableCell className="min-w-[140px]">
                <SelectCell
                  field="statutRelation"
                  value={c.statutRelation}
                  onSave={(v) =>
                    onUpdate(c.id, { statutRelation: v as Compte["statutRelation"] })
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                <TextCell
                  type="number"
                  align="right"
                  value={c.scoreAdilStar}
                  onSave={(v) => onUpdate(c.id, { scoreAdilStar: v as number | null })}
                />
              </TableCell>
              <TableCell className="text-right">
                <TextCell
                  type="number"
                  align="right"
                  value={c.arrPondere}
                  onSave={(v) => onUpdate(c.id, { arrPondere: v as number | null })}
                />
              </TableCell>
              <TableCell className="min-w-[140px]">
                <SelectCell
                  field="categorie"
                  value={c.categorie}
                  onSave={(v) => onUpdate(c.id, { categorie: v as string | null })}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-150">
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Vue 360 de ${c.compte}`}
                  >
                    <Link href={`/compte/${c.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  <PlanStrategiqueEditor
                    compteName={c.compte}
                    value={c.planStrategique}
                    onSave={(v) => onUpdate(c.id, { planStrategique: v })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Archiver ${c.compte}`}
                    disabled={c.statutRelation === "Dormante"}
                    onClick={() => onArchive(c.id)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  {c.url && (
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Ouvrir ${c.compte} dans Notion`}
                    >
                      <Link href={c.url} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    <p className="text-xs text-muted-foreground">
      Colonnes Compte, Score, ARR : cliquer pour modifier. Autres colonnes : liste déroulante.
    </p>
    </div>
  );
}
