"use client";

import * as React from "react";
import { Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { badgeClass, SELECT_FIELDS } from "@/lib/compte-ui";
import { cn } from "@/lib/utils";

type SelectField = keyof typeof SELECT_FIELDS;

interface BaseProps {
  /** Valeur actuelle (string ou number). */
  value: string | number | null;
  /** Sauvegarde la nouvelle valeur ; renvoie une promesse (peut rejeter). */
  onSave: (next: string | number | null) => Promise<void>;
}

/** Cellule select éditable inline (Secteur, Priorité, Stage, Statut relation). */
export function SelectCell({
  field,
  value,
  onSave,
}: BaseProps & { field: SelectField }) {
  const [saving, setSaving] = React.useState(false);
  const options = SELECT_FIELDS[field].options;

  return (
    <Select
      value={(value as string) ?? "__none__"}
      disabled={saving}
      onValueChange={async (v) => {
        const next = v === "__none__" ? null : v;
        if (next === value) return;
        setSaving(true);
        try {
          await onSave(next);
        } finally {
          setSaving(false);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-full border-0 bg-transparent px-1 shadow-none focus:ring-1",
          saving && "opacity-50"
        )}
      >
        {value ? (
          <Badge className={cn("font-normal", badgeClass(field, value as string))}>
            {value}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">—</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Cellule texte/nombre éditable au clic. */
export function TextCell({
  value,
  onSave,
  type = "text",
  placeholder = "—",
  align = "left",
}: BaseProps & {
  type?: "text" | "number";
  placeholder?: string;
  align?: "left" | "right";
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(
    value == null ? "" : String(value)
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  async function commit() {
    let next: string | number | null = draft.trim();
    if (type === "number") {
      next = draft.trim() === "" ? null : Number(draft);
      if (next != null && Number.isNaN(next)) {
        setEditing(false);
        return;
      }
    } else if (next === "") {
      next = "";
    }
    if (next === value || (next === "" && (value == null || value === ""))) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "group flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent",
          align === "right" && "justify-end"
        )}
      >
        <span className={cn(value == null || value === "" ? "text-muted-foreground" : "")}>
          {value == null || value === "" ? placeholder : String(value)}
        </span>
        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        autoFocus
        type={type}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-7 px-1 text-sm"
      />
      <button
        type="button"
        onClick={commit}
        disabled={saving}
        className="text-green-600 hover:text-green-700"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
