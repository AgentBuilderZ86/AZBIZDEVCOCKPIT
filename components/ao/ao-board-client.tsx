"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AoUploadDialog } from "./ao-upload-dialog";
import type { Ao, AoStatut, Compte } from "@/lib/types";
import { AO_STATUTS, AO_STATUT_LABELS } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const STATUT_STYLE: Record<AoStatut, string> = {
  BO:     "bg-slate-100 text-slate-700",
  BO_GO:  "bg-blue-100 text-blue-700",
  BO_NOGO:"bg-red-100 text-red-600",
  P2P:    "bg-violet-100 text-violet-700",
  PP:     "bg-orange-100 text-orange-700",
  PW:     "bg-emerald-100 text-emerald-700",
  PL:     "bg-stone-200 text-stone-600",
};

const STATUT_NEXT: Partial<Record<AoStatut, AoStatut[]>> = {
  BO:     ["BO_GO", "BO_NOGO"],
  BO_GO:  ["P2P", "BO_NOGO"],
  P2P:    ["PP", "BO_NOGO"],
  PP:     ["PW", "PL"],
};

function scoreStyle(score: number | null): string {
  if (score == null) return "bg-muted text-muted-foreground";
  if (score >= 8) return "bg-emerald-100 text-emerald-700";
  if (score >= 5) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* Tab counts                                                          */
/* ------------------------------------------------------------------ */

type FilterTab = "all" | "active" | AoStatut;

const TAB_CONFIG: Array<{ id: FilterTab; label: string }> = [
  { id: "all",    label: "Tous" },
  { id: "active", label: "En cours" },
  { id: "BO",     label: "BO" },
  { id: "BO_GO",  label: "BO Go" },
  { id: "P2P",    label: "P2P" },
  { id: "PP",     label: "Pitch" },
  { id: "PW",     label: "Won" },
  { id: "PL",     label: "Lost" },
];

function filterAos(aos: Ao[], tab: FilterTab): Ao[] {
  if (tab === "all") return aos;
  if (tab === "active") return aos.filter((a) => !["BO_NOGO", "PW", "PL"].includes(a.statut));
  return aos.filter((a) => a.statut === tab);
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

interface Props {
  initialAos: Ao[];
  comptes: Compte[];
}

export function AoBoardClient({ initialAos, comptes }: Props) {
  const [aos, setAos] = React.useState<Ao[]>(initialAos);
  const [tab, setTab] = React.useState<FilterTab>("active");
  const [loading, setLoading] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/ao");
      const d = (await r.json()) as Record<string, unknown>;
      setAos((d.aos as Ao[]) ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function patchAo(id: string, patch: Partial<{ statut: AoStatut; notes: string; compteNotionId: string; compteNom: string }>) {
    // Optimistic update
    setAos((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
    await fetch(`/api/ao/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  const filtered = React.useMemo(() => filterAos(aos, tab), [aos, tab]);

  const counts = React.useMemo(() => {
    const m: Record<string, number> = { all: aos.length, active: 0 };
    for (const a of aos) {
      m[a.statut] = (m[a.statut] ?? 0) + 1;
      if (!["BO_NOGO", "PW", "PL"].includes(a.statut)) m.active = (m.active ?? 0) + 1;
    }
    return m;
  }, [aos]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {TAB_CONFIG.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                tab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {label}
              {counts[id] != null && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  tab === id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white/80 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <AoUploadDialog onImported={refresh} />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {aos.length === 0
            ? "Aucun AO importé. Cliquez sur « Importer » pour charger votre premier fichier."
            : "Aucun AO dans cette catégorie."}
        </div>
      ) : (
        <div className="rounded-xl border bg-white/80 backdrop-blur-sm overflow-hidden" style={{ boxShadow: "0 1px 3px hsl(220 20% 0% / 0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">AO / Client</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Deadline</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">Budget</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">Score IA</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Compte lié</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">Notes</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((ao) => (
                  <AoRow
                    key={ao.id}
                    ao={ao}
                    comptes={comptes}
                    onPatch={(patch) => patchAo(ao.id, patch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Légende pipeline */}
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span className="font-medium">Pipeline :</span>
        {AO_STATUTS.map((s) => (
          <span key={s} className={cn("rounded-full px-2 py-0.5 font-medium", STATUT_STYLE[s])}>
            {AO_STATUT_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AoRow                                                               */
/* ------------------------------------------------------------------ */

function AoRow({
  ao, comptes, onPatch,
}: {
  ao: Ao;
  comptes: Compte[];
  onPatch: (patch: Partial<{ statut: AoStatut; notes: string; compteNotionId: string; compteNom: string }>) => void;
}) {
  const [editingNotes, setEditingNotes] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState(ao.notes);

  const days = daysUntil(ao.deadline);
  const nextStatuts = STATUT_NEXT[ao.statut] ?? [];

  return (
    <tr className="group hover:bg-primary/[0.02] transition-colors duration-100">
      {/* AO title + client + synthèse */}
      <td className="px-4 py-3 min-w-[220px] max-w-[320px]">
        <p className="font-medium leading-tight truncate">{ao.titre || "—"}</p>
        {ao.client && (
          <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{ao.client}</p>
        )}
        {ao.synthese && (
          <p className="text-[10px] text-muted-foreground/60 mt-1 line-clamp-2 leading-snug">{ao.synthese}</p>
        )}
      </td>

      {/* Deadline */}
      <td className="px-3 py-3 whitespace-nowrap text-xs">
        <span className={cn(
          days != null && days < 0 ? "text-muted-foreground/40 line-through" :
          days != null && days < 30 ? "font-semibold text-orange-600" : ""
        )}>
          {fmtDate(ao.deadline)}
        </span>
        {days != null && days >= 0 && days < 30 && (
          <p className="text-[10px] text-orange-500">{days}j</p>
        )}
      </td>

      {/* Budget */}
      <td className="px-3 py-3 text-right text-xs font-medium tabular-nums">
        {ao.budgetKEur != null ? `${ao.budgetKEur}k€` : "—"}
      </td>

      {/* Score IA */}
      <td className="px-3 py-3 text-center">
        {ao.scoreFit != null ? (
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", scoreStyle(ao.scoreFit))}>
            {ao.scoreFit}/10
          </span>
        ) : ao.suggestion ? (
          <span className="text-[10px] text-muted-foreground">…</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </td>

      {/* Statut + next actions */}
      <td className="px-3 py-3">
        <div className="flex flex-col gap-1">
          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold w-fit", STATUT_STYLE[ao.statut])}>
            {AO_STATUT_LABELS[ao.statut]}
          </span>
          {nextStatuts.length > 0 && (
            <div className="flex gap-1">
              {nextStatuts.map((s) => (
                <button
                  key={s}
                  onClick={() => onPatch({ statut: s })}
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:scale-105",
                    STATUT_STYLE[s]
                  )}
                  title={`Passer à ${AO_STATUT_LABELS[s]}`}
                >
                  → {AO_STATUT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Compte lié */}
      <td className="px-3 py-3 min-w-[140px]">
        <select
          value={ao.compteNotionId}
          onChange={(e) => {
            const c = comptes.find((c) => c.id === e.target.value);
            onPatch({ compteNotionId: e.target.value, compteNom: c?.compte ?? "" });
          }}
          className="w-full max-w-[160px] rounded-md border bg-transparent px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">— Aucun —</option>
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.compte}</option>
          ))}
        </select>
      </td>

      {/* Notes inline */}
      <td className="px-3 py-3 min-w-[160px]">
        {editingNotes ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full resize-none rounded border bg-muted/30 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={() => { onPatch({ notes: notesDraft }); setEditingNotes(false); }}
                className="rounded px-2 py-0.5 text-[10px] bg-primary text-primary-foreground font-medium"
              >
                OK
              </button>
              <button
                onClick={() => { setNotesDraft(ao.notes); setEditingNotes(false); }}
                className="rounded px-2 py-0.5 text-[10px] bg-muted text-muted-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNotes(true)}
            className="block w-full text-left text-xs text-muted-foreground/70 hover:text-foreground transition-colors min-h-[1.5rem]"
          >
            {ao.notes || <span className="italic opacity-50">Ajouter une note…</span>}
          </button>
        )}
      </td>

      {/* External link */}
      <td className="px-2 py-3 text-center">
        {ao.sourceUrl ? (
          <Link href={ao.sourceUrl} target="_blank" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Pipeline KPIs                                                       */
/* ------------------------------------------------------------------ */

export function AoPipelineKpis({ aos }: { aos: Ao[] }) {
  const active = aos.filter((a) => !["BO_NOGO", "PW", "PL"].includes(a.statut));
  const won = aos.filter((a) => a.statut === "PW");
  const budgetWon = won.reduce((s, a) => s + (a.budgetKEur ?? 0), 0);
  const avgScore = active.filter((a) => a.scoreFit != null).reduce((s, a, _, arr) => s + (a.scoreFit ?? 0) / arr.length, 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "AOs en cours", value: String(active.length), color: "text-blue-700" },
        { label: "Qualifiés ≥ 7/10", value: String(active.filter((a) => (a.scoreFit ?? 0) >= 7).length), color: "text-emerald-700" },
        { label: "Won", value: `${budgetWon > 0 ? `${budgetWon}k€` : won.length}`, color: "text-emerald-700" },
        { label: "Score moyen", value: active.length > 0 ? `${avgScore.toFixed(1)}/10` : "—", color: "text-primary" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bento-card p-4">
          <p className="label-muted">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold tracking-tight", color)}>{value}</p>
        </div>
      ))}
    </div>
  );
}
