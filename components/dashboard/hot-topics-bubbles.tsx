"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";

export interface HotTopic {
  topic: string;
  frequency: number;
  sectors: string[];
}

const W = 920;
const H = 320;

/* ── Familles thématiques (classification heuristique par mots-clés) ── */
interface Family {
  key: string;
  label: string;
  short: string;
  keywords: string[];
}
const FAMILIES: Family[] = [
  { key: "risque", label: "Risque, Conformité & ESG", short: "Risque & ESG", keywords: ["risque", "conform", "compliance", "esg", "reglementaire", "dora", "bale", "audit", "kyc", "lcb"] },
  { key: "data", label: "Data & IA", short: "Data & IA", keywords: ["data", " ia", "ia ", "intelligence artificielle", "analytics", "machine learning", "llm", "corpgpt", "gpt", "datalake", "datawarehouse", "donnees", "mdm"] },
  { key: "excellence", label: "Excellence opérationnelle", short: "Excellence op.", keywords: ["process", "processus", "excellence op", "standardis", "supply", "lean", "optimisation", "performance op", "industrialisation"] },
  { key: "cx", label: "CX, Distribution & Réseau", short: "CX & Réseau", keywords: ["cx", "client", "distribution", "reseau", "retail", "station", "commercial", "vente", "marketing", "parcours"] },
  { key: "transfo", label: "Transformation digitale & SI", short: "Transfo. digitale", keywords: ["digital", "transformation", "cio", "si ", "erp", "cloud", "systeme d", "applicatif", "modernisation"] },
  { key: "strategie", label: "Stratégie & Organisation", short: "Stratégie & Org.", keywords: ["strateg", "organis", "comex", "pmo", "acquisition", "integration", "m&a", "pilotage", "gouvernance", "architecture", "operating model", "filiale", "conglom"] },
];
const OTHER: Family = { key: "autre", label: "Autres sujets", short: "Autres", keywords: [] };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function classify(topic: string): Family {
  const t = norm(topic);
  for (const f of FAMILIES) {
    if (f.keywords.some((k) => t.includes(norm(k)))) return f;
  }
  return OTHER;
}

interface FamilyAgg {
  key: string;
  label: string;
  short: string;
  total: number;
  ratio: number;
  items: HotTopic[];
}

function aggregate(topics: HotTopic[]): FamilyAgg[] {
  const map = new Map<string, FamilyAgg>();
  for (const t of topics) {
    const f = classify(t.topic);
    if (!map.has(f.key)) map.set(f.key, { key: f.key, label: f.label, short: f.short, total: 0, ratio: 0, items: [] });
    const agg = map.get(f.key)!;
    agg.total += t.frequency || 1;
    agg.items.push(t);
  }
  const arr = Array.from(map.values());
  const max = Math.max(1, ...arr.map((a) => a.total));
  const min = Math.min(...arr.map((a) => a.total));
  const span = Math.max(1, max - min);
  for (const a of arr) {
    a.ratio = (a.total - min) / span;
    a.items.sort((x, y) => (y.frequency || 1) - (x.frequency || 1));
  }
  return arr.sort((a, b) => b.total - a.total);
}

function heatColor(ratio: number): string {
  const hue = 255 - ratio * 240; // indigo → orange-rouge
  return `${hue} 85% ${58 + ratio * 6}%`;
}

interface Bubble extends FamilyAgg {
  x: number;
  y: number;
  r: number;
}
function packBubbles(fams: FamilyAgg[]): Bubble[] {
  const max = Math.max(1, ...fams.map((f) => f.total));
  const cx = W / 2, cy = H / 2;
  const bubbles: Bubble[] = fams.map((f, i) => {
    const r = 34 + Math.sqrt(f.total / max) * 56;
    const a = i * 2.399963;
    const rad = 22 * Math.sqrt(i);
    return { ...f, r, x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.7 };
  });
  for (let iter = 0; iter < 160; iter++) {
    for (const b of bubbles) {
      b.x += (cx - b.x) * 0.02;
      b.y += (cy - b.y) * 0.03;
    }
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r + 8;
        if (d < minD) {
          const push = (minD - d) / 2, ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }
  for (const b of bubbles) {
    b.x = Math.max(b.r + 6, Math.min(W - b.r - 6, b.x));
    b.y = Math.max(b.r + 6, Math.min(H - b.r - 6, b.y));
  }
  return bubbles;
}

export function HotTopicsBubbles({ topics }: { topics: HotTopic[] }) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const fams = React.useMemo(() => aggregate(topics), [topics]);
  const bubbles = React.useMemo(() => packBubbles(fams), [fams]);

  if (fams.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun topic détecté.</p>;
  }

  const current = selected ? fams.find((f) => f.key === selected) : null;

  // ── Vue détail (sous-familles) ──
  if (current) {
    const maxItem = Math.max(1, ...current.items.map((i) => i.frequency || 1));
    const c = heatColor(current.ratio);
    return (
      <div className="animate-fade-in">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Toutes les familles
        </button>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: `hsl(${c})`, boxShadow: `0 0 10px hsl(${c} / 0.7)` }} />
          <h3 className="font-display text-base font-bold text-foreground">{current.label}</h3>
          <span className="text-xs text-muted-foreground">{current.items.length} sujet{current.items.length > 1 ? "s" : ""} · {current.total} occurrence{current.total > 1 ? "s" : ""}</span>
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {current.items.map((it) => {
            const w = ((it.frequency || 1) / maxItem) * 100;
            return (
              <li key={it.topic} className="rounded-lg border border-border/50 bg-card/40 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm text-foreground" title={it.topic}>{it.topic}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">×{it.frequency || 1}</span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted/60">
                  <div className="h-full rounded-full" style={{ width: `${w}%`, background: `hsl(${c})` }} />
                </div>
                {it.sectors?.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground/70">{it.sectors.slice(0, 4).join(" · ")}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── Vue familles (bulles) ──
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Familles de topics chauds">
        {bubbles.map((b, i) => {
          const c = heatColor(b.ratio);
          return (
            <g
              key={b.key}
              transform={`translate(${b.x} ${b.y})`}
              className="cursor-pointer"
              onClick={() => setSelected(b.key)}
            >
              <circle r={b.r} fill={`hsl(${c} / 0.18)`} stroke={`hsl(${c})`} strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 ${12 + b.ratio * 18}px hsl(${c} / 0.5))` }}
                className="transition-all hover:brightness-110">
                <animate attributeName="r" from="0" to={b.r} begin={`${i * 0.06}s`} dur="0.6s" fill="freeze" />
              </circle>
              <text textAnchor="middle" dy="-2" className="fill-foreground" style={{ fontSize: Math.max(12, Math.min(17, b.r / 3.4)), fontWeight: 700, pointerEvents: "none" }}>
                {b.short}
              </text>
              <text textAnchor="middle" dy="16" className="fill-foreground/65" style={{ fontSize: 11, fontWeight: 600, pointerEvents: "none" }}>
                {b.items.length} sujets · ×{b.total}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[11px] text-muted-foreground/60">Clique une famille pour le détail des sujets</p>
    </div>
  );
}
