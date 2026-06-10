"use client";

import * as React from "react";
import Link from "next/link";
import { Radio, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Flame, ArrowUpRight, Newspaper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { parseApiJson } from "@/lib/parse-api-json";

interface FeedItem {
  id: string;
  eventType: string;
  source: string;
  eventDate: string;
  accountId: string | null;
  compte: string;
  secteur: string;
  stage: string | null;
  title: string;
  summary: string;
  url: string | null;
  from: unknown;
  to: unknown;
}
interface Trend {
  secteur: string;
  count: number;
  comptes: string[];
  keywords: string[];
}

const WINDOWS = [
  { label: "7 j", days: 7 },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
];

const TYPE_FILTERS = [
  { key: "signal", label: "Signaux", icon: Newspaper },
  { key: "score_change", label: "Scores", icon: TrendingUp },
  { key: "stage_change", label: "Stages", icon: ArrowUpRight },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 86_400_000;
}

const TYPE_META: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  signal: { color: "190 85% 55%", icon: Radio, label: "Signal" },
  score_change: { color: "250 84% 67%", icon: TrendingUp, label: "Score" },
  stage_change: { color: "40 92% 58%", icon: ArrowUpRight, label: "Stage" },
};

export function IntelligenceFeed() {
  const [items, setItems] = React.useState<FeedItem[]>([]);
  const [trends, setTrends] = React.useState<Trend[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [enabled, setEnabled] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [days, setDays] = React.useState(30);
  const [activeTypes, setActiveTypes] = React.useState<string[]>([]);
  const [sectorFilter, setSectorFilter] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ sinceDays: String(days) });
      if (activeTypes.length) qs.set("types", activeTypes.join(","));
      const res = await fetch(`/api/intelligence/feed?${qs}`);
      const data = await parseApiJson(res);
      if (data.enabled === false) setEnabled(false);
      else {
        setEnabled(true);
        setItems((data.items as FeedItem[]) ?? []);
        setTrends((data.trends as Trend[]) ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [days, activeTypes]);

  React.useEffect(() => { void load(); }, [load]);

  async function scan() {
    setScanning(true);
    try {
      await fetch("/api/intelligence/feed/scan", { method: "POST" });
    } catch { /* ignore */ }
    finally { setScanning(false); }
  }

  const shown = sectorFilter ? items.filter((i) => i.secteur === sectorFilter) : items;

  if (!enabled) {
    return (
      <div className="bento-card p-6 text-sm text-muted-foreground">
        Le flux d&apos;intelligence nécessite la couche Intelligence (DATABASE_URL). La veille
        quotidienne alimentera ce flux une fois activée.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Bandeau tendances */}
      {trends.length > 0 && (
        <div>
          <p className="label-muted mb-2 flex items-center gap-1.5"><Flame className="h-3.5 w-3.5 text-orange-400" /> Tendances sectorielles</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {trends.map((t) => {
              const on = sectorFilter === t.secteur;
              return (
                <button
                  key={t.secteur}
                  onClick={() => setSectorFilter(on ? null : t.secteur)}
                  className={cn(
                    "min-w-[210px] shrink-0 rounded-xl border p-3 text-left transition-all",
                    on ? "border-primary/50 bg-primary/10" : "border-border/60 bg-card/50 hover:border-primary/30"
                  )}
                  style={on ? { boxShadow: "0 0 24px -8px hsl(var(--primary) / 0.5)" } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-foreground">{t.secteur}</span>
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-300">
                      {t.count} signaux
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.comptes.length} comptes · {t.comptes.slice(0, 3).join(", ")}</p>
                  {t.keywords.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.keywords.map((k) => (
                        <span key={k} className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{k}</span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border/60 bg-card/40 p-0.5">
          {WINDOWS.map((w) => (
            <button key={w.days} onClick={() => setDays(w.days)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-all", days === w.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TYPE_FILTERS.map(({ key, label, icon: Icon }) => {
            const on = activeTypes.includes(key);
            return (
              <button key={key}
                onClick={() => setActiveTypes((s) => (on ? s.filter((x) => x !== key) : [...s, key]))}
                className={cn("inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-all",
                  on ? "border-primary/50 bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:text-foreground")}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            );
          })}
        </div>
        {sectorFilter && (
          <button onClick={() => setSectorFilter(null)} className="text-xs text-primary hover:underline">
            secteur : {sectorFilter} ✕
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Rafraîchir
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => void scan()} disabled={scanning}>
            <Sparkles className="h-3.5 w-3.5" /> {scanning ? "Lancement…" : "Scanner"}
          </Button>
        </div>
      </div>

      {/* Flux */}
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/40" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="bento-card p-8 text-center text-sm text-muted-foreground">
          Aucun signal sur cette période. Lance un scan pour alimenter le flux.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((it, idx) => (
            <FeedCard key={it.id} item={it} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, index }: { item: FeedItem; index: number }) {
  const meta = TYPE_META[item.eventType] ?? TYPE_META.signal;
  const Icon = meta.icon;
  const fresh = isNew(item.eventDate);
  return (
    <div
      className="bento-card animate-fade-up flex gap-3 p-3.5"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `hsl(${meta.color} / 0.15)`, color: `hsl(${meta.color})`, boxShadow: `0 0 14px -4px hsl(${meta.color} / 0.7)` }}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.accountId ? (
            <Link href={`/compte/${item.accountId}`} className="text-sm font-semibold text-foreground hover:text-primary">
              {item.compte}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-foreground">{item.compte}</span>
          )}
          <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px] font-normal text-muted-foreground">{item.secteur}</Badge>
          {fresh && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0 text-[10px] font-semibold text-emerald-300 animate-glow-pulse">nouveau</span>}
          <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(item.eventDate)}</span>
        </div>

        {item.eventType === "signal" ? (
          <>
            <p className="mt-1 text-sm font-medium text-foreground">{item.title || "Signal"}</p>
            {item.summary && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : item.eventType === "score_change" ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
            {Number(item.to) >= Number(item.from) ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
            Score AdilStar <span className="font-semibold">{String(item.from)} → {String(item.to)}</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-foreground">
            Changement de stage <span className="font-semibold">{String(item.from)} → {String(item.to)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
