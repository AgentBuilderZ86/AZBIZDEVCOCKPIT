"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  formatJournalPayload,
  journalEventLabel,
  journalSourceLabel,
} from "@/lib/intelligence/journal-display";
import { parseApiJson } from "@/lib/parse-api-json";

interface JournalEvent {
  id: string;
  eventType: string;
  eventDate: string;
  payload: Record<string, unknown>;
  source: string;
}

interface Props {
  compteId: string;
  enabled: boolean;
  disabledReason?: string;
  refreshKey?: number;
}

export function JournalPanel({
  compteId,
  enabled,
  disabledReason,
  refreshKey = 0,
}: Props) {
  const [events, setEvents] = React.useState<JournalEvent[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/compte/${compteId}/journal`);
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error ?? "Chargement impossible.");
      setEvents(
        ((data.events as (JournalEvent & { eventDate?: string })[]) ?? []).map((e) => ({
          ...e,
          eventDate:
            typeof e.eventDate === "string"
              ? e.eventDate
              : new Date(e.eventDate as unknown as string).toISOString(),
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur journal.");
    } finally {
      setLoading(false);
    }
  }, [compteId, enabled]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/compte/${compteId}/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error ?? "Échec enregistrement.");
      setNote("");
      toast.success("Note ajoutée au journal.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) {
    return (
      <div className="mt-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Journal de compte</p>
        <p className="mt-1">{disabledReason ?? "Couche Intelligence inactive."}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Journal de compte
      </h2>

      <form onSubmit={submitNote} className="space-y-2 rounded-md border p-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="CR de RDV, relance, décision…"
          rows={3}
          className="text-sm"
        />
        <Button type="submit" size="sm" disabled={saving || !note.trim()}>
          {saving ? "Enregistrement…" : "Ajouter au journal"}
        </Button>
      </form>

      <div className="rounded-md border text-sm">
        {loading && (
          <p className="p-3 text-muted-foreground">Chargement…</p>
        )}
        {!loading && events.length === 0 && (
          <p className="p-3 text-muted-foreground">
            Aucun événement (enrichissements, scores cron et notes apparaîtront ici).
          </p>
        )}
        <ul className="divide-y">
          {events.map((ev) => (
            <li key={ev.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="font-medium">
                  {journalEventLabel(ev.eventType)}
                </span>
                <time
                  className="text-xs text-muted-foreground"
                  dateTime={ev.eventDate}
                >
                  {formatEventDate(ev.eventDate)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                {formatJournalPayload(ev.eventType, ev.payload)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80">
                {journalSourceLabel(ev.source)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
