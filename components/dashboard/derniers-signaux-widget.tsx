"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio, ChevronRight, ExternalLink } from "lucide-react";
import { parseApiJson } from "@/lib/parse-api-json";

interface FeedItem {
  id: string;
  compte: string;
  secteur: string;
  title: string;
  url: string | null;
  accountId: string | null;
  eventDate: string;
}

export function DerniersSignauxWidget() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/intelligence/feed?types=signal&sinceDays=30")
      .then(parseApiJson)
      .then((data) => {
        if (data.enabled === false) setEnabled(false);
        else setItems(((data.items as FeedItem[]) ?? []).slice(0, 4));
      })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, []);

  if (!enabled) return null;

  return (
    <div className="bento-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-muted flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-cyan-400" /> Derniers signaux</p>
        <Link href="/veille" className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
          Tout voir <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun signal récent. Lance une veille depuis la page Veille.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" style={{ boxShadow: "0 0 8px hsl(190 85% 55%)" }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{it.title || "Signal"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {it.accountId ? (
                    <Link href={`/compte/${it.accountId}`} className="hover:text-primary">{it.compte}</Link>
                  ) : it.compte}
                  {" · "}{it.secteur}
                </p>
              </div>
              {it.url && (
                <a href={it.url} target="_blank" rel="noreferrer" className="mt-0.5 text-muted-foreground hover:text-primary" aria-label="Source">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
