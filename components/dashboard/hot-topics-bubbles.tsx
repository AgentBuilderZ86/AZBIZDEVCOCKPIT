"use client";

import * as React from "react";

export interface HotTopic {
  topic: string;
  frequency: number;
  sectors: string[];
}

const W = 920;
const H = 300;

interface Bubble extends HotTopic {
  x: number;
  y: number;
  r: number;
  ratio: number;
}

/** Couleur "chaleur" : froid (indigo) → chaud (orange/rouge) selon la récurrence. */
function heatColor(ratio: number): string {
  const hue = 255 - ratio * 240; // 255 indigo → 15 orange-rouge
  return `${hue} 85% ${58 + ratio * 6}%`;
}

function packBubbles(topics: HotTopic[]): Bubble[] {
  const max = Math.max(1, ...topics.map((t) => t.frequency));
  const min = Math.min(...topics.map((t) => t.frequency));
  const span = Math.max(1, max - min);
  const cx = W / 2, cy = H / 2;

  // Rayon ∝ √fréquence (aire ∝ fréquence).
  const bubbles: Bubble[] = topics.map((t, i) => {
    const ratio = (t.frequency - min) / span;
    const r = 20 + Math.sqrt(t.frequency / max) * 52;
    // Init en spirale dorée autour du centre (plus gros = plus au centre).
    const a = i * 2.399963;
    const rad = 14 * Math.sqrt(i);
    return { ...t, ratio, r, x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad * 0.7 };
  });

  // Relaxation : gravité vers le centre + répulsion anti-chevauchement.
  for (let iter = 0; iter < 140; iter++) {
    for (const b of bubbles) {
      b.x += (cx - b.x) * 0.018;
      b.y += (cy - b.y) * 0.026;
    }
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r + 4;
        if (d < minD) {
          const push = (minD - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }
  for (const b of bubbles) {
    b.x = Math.max(b.r + 4, Math.min(W - b.r - 4, b.x));
    b.y = Math.max(b.r + 4, Math.min(H - b.r - 4, b.y));
  }
  return bubbles;
}

export function HotTopicsBubbles({ topics }: { topics: HotTopic[] }) {
  const [hovered, setHovered] = React.useState<Bubble | null>(null);
  const data = React.useMemo(() => topics.slice(0, 16).sort((a, b) => b.frequency - a.frequency), [topics]);
  const bubbles = React.useMemo(() => packBubbles(data), [data]);

  if (bubbles.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun topic détecté.</p>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Topics chauds — bulles pondérées">
        {bubbles.map((b, i) => {
          const c = heatColor(b.ratio);
          const isHover = hovered?.topic === b.topic;
          const showLabel = b.r >= 30 || isHover;
          return (
            <g
              key={b.topic}
              transform={`translate(${b.x} ${b.y})`}
              onMouseEnter={() => setHovered(b)}
              onMouseLeave={() => setHovered((h) => (h?.topic === b.topic ? null : h))}
              style={{ cursor: "default" }}
            >
              <circle r={b.r} fill={`hsl(${c} / 0.18)`} stroke={`hsl(${c})`} strokeWidth={isHover ? 2 : 1}
                style={{ filter: `drop-shadow(0 0 ${10 + b.ratio * 16}px hsl(${c} / 0.55))`, transition: "stroke-width .2s" }}>
                <animate attributeName="r" from="0" to={b.r} begin={`${i * 0.04}s`} dur="0.6s" fill="freeze" />
              </circle>
              {showLabel && (
                <>
                  <text textAnchor="middle" dy={b.frequency != null ? "-1" : "4"} className="fill-foreground"
                    style={{ fontSize: Math.max(10, Math.min(15, b.r / 3.6)), fontWeight: 600, pointerEvents: "none" }}>
                    {b.topic.length > 16 && b.r < 46 ? b.topic.slice(0, 15) + "…" : b.topic}
                  </text>
                  <text textAnchor="middle" dy="14" className="fill-foreground/60"
                    style={{ fontSize: 10, fontWeight: 600, pointerEvents: "none" }}>
                    ×{b.frequency}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 -translate-y-full rounded-xl border border-border/70 bg-popover/90 p-2.5 shadow-glow backdrop-blur-xl"
          style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, marginTop: -8 }}
        >
          <p className="text-sm font-semibold text-foreground">{hovered.topic}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {hovered.frequency} occurrence{hovered.frequency > 1 ? "s" : ""}
            {hovered.sectors?.length ? ` · ${hovered.sectors.slice(0, 3).join(", ")}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
