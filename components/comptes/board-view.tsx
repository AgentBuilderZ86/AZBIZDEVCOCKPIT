"use client";

import * as React from "react";
import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectCell } from "./inline-cell";
import { PlanStrategiqueEditor } from "./plan-strategique-editor";
import { badgeClass } from "@/lib/compte-ui";
import { SECTEURS, type Compte, type CompteUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  comptes: Compte[];
  onUpdate: (id: string, patch: CompteUpdate) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
}

export function BoardView({ comptes, onUpdate, onArchive }: Props) {
  const groups = React.useMemo(() => {
    const map = new Map<string, Compte[]>();
    for (const s of SECTEURS) map.set(s, []);
    map.set("— Sans secteur", []);
    for (const c of comptes) {
      const key = c.secteur ?? "— Sans secteur";
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).filter(([, list]) => list.length > 0);
  }, [comptes]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {groups.map(([secteur, list]) => (
        <div key={secteur} className="w-72 shrink-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold">{secteur}</h3>
            <span className="text-xs text-muted-foreground">{list.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {list.map((c) => (
              <div key={c.id} className="rounded-md border bg-card p-3 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{c.compte}</span>
                  <div className="flex shrink-0 gap-0.5">
                    <PlanStrategiqueEditor
                      compteName={c.compte}
                      value={c.planStrategique}
                      onSave={(v) => onUpdate(c.id, { planStrategique: v })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Archiver"
                      disabled={c.statutRelation === "Dormante"}
                      onClick={() => onArchive(c.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {c.priorite && (
                    <Badge className={cn("font-normal", badgeClass("priorite", c.priorite))}>
                      {c.priorite}
                    </Badge>
                  )}
                  {c.scoreAdilStar != null && (
                    <Badge variant="outline" className="font-normal">
                      ★ {c.scoreAdilStar}
                    </Badge>
                  )}
                  {c.arrPondere != null && (
                    <Badge variant="outline" className="font-normal">
                      {c.arrPondere} k€
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <SelectCell
                    field="stage"
                    value={c.stage}
                    onSave={(v) => onUpdate(c.id, { stage: v as Compte["stage"] })}
                  />
                  <SelectCell
                    field="statutRelation"
                    value={c.statutRelation}
                    onSave={(v) =>
                      onUpdate(c.id, { statutRelation: v as Compte["statutRelation"] })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
