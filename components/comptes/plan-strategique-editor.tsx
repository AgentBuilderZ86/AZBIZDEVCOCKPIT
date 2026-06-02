"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  compteName: string;
  value: string;
  onSave: (next: string) => Promise<void>;
}

export function PlanStrategiqueEditor({ compteName, value, onSave }: Props) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Plan stratégique">
          <FileText
            className={value ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Plan stratégique — {compteName}</DialogTitle>
          <DialogDescription>
            Édition du champ long « Plan stratégique compte » (write-back Notion).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={16}
          placeholder="Synthèse stratégique du compte : enjeux, parties prenantes, offres pertinentes, prochaines étapes…"
          className="min-h-[320px] font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button
            disabled={saving || draft === value}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                setOpen(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
