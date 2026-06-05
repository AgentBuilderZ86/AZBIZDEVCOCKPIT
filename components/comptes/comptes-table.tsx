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
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length + 1} className="h-24 text-center text-muted-foreground">
                Aucun compte.
              </TableCell>
            </TableRow>
          )}
          {sorted.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="min-w-[200px] font-medium">
                <TextCell
                  value={c.compte}
                  onSave={(v) => onUpdate(c.id, { compte: String(v) })}
                />
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
              <TableCell>
                <div className="flex items-center justify-end gap-1">
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
          ))}
        </TableBody>
      </Table>
    </div>
    <p className="text-xs text-muted-foreground">
      Colonnes Compte, Score, ARR : cliquer pour modifier. Autres colonnes : liste déroulante.
    </p>
    </div>
  );
}
