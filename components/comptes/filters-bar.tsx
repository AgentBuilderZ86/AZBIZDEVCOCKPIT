"use client";

import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SELECT_FIELDS } from "@/lib/compte-ui";

export type FilterState = {
  secteur: string;
  priorite: string;
  stage: string;
  statutRelation: string;
};

const ALL = "__all__";

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  view: "table" | "board";
  onViewChange: (v: "table" | "board") => void;
  count: number;
}

export function FiltersBar({ filters, onChange, view, onViewChange, count }: Props) {
  const fields: Array<keyof FilterState> = [
    "secteur",
    "priorite",
    "stage",
    "statutRelation",
  ];
  const hasFilters = fields.some((f) => filters[f]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map((field) => (
        <Select
          key={field}
          value={filters[field] || ALL}
          onValueChange={(v) =>
            onChange({ ...filters, [field]: v === ALL ? "" : v })
          }
        >
          <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
            <SelectValue placeholder={SELECT_FIELDS[field].label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{SELECT_FIELDS[field].label} : tous</SelectItem>
            {SELECT_FIELDS[field].options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() =>
            onChange({ secteur: "", priorite: "", stage: "", statutRelation: "" })
          }
        >
          Réinitialiser
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {count} compte{count > 1 ? "s" : ""}
      </span>

      <div className="flex rounded-md border">
        <Button
          variant={view === "table" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-r-none"
          onClick={() => onViewChange("table")}
          title="Vue tableau"
        >
          <TableIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={view === "board" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-l-none"
          onClick={() => onViewChange("board")}
          title="Vue board par secteur"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
