"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw } from "lucide-react";

export interface GalaxyStar {
  id: string;
  nom: string;
  secteur: string;
  stage: string | null;
  score: number | null;
  arr: number | null;
}

const W = 1000;
const H = 700;
const PAD = 80;

/** Couleur/lueur par stage (vives pour fond sombre Aurora). */
const STAGE: Record<string, string> = {
  Hot: "18 92% 60%",
  Active: "212 90% 62%",
  Warm: "40 92% 58%",
  Won: "150 70% 50%",
  Cold: "220 16% 62%",
  Lost: "220 10% 45%",
};
function stageColor(stage: string | null): string {
  return STAGE[stage ?? "Cold"] ?? "250 84% 67%";
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface Placed extends GalaxyStar {
  x: number;
  y: number;
  r: number;
  color: string;
  drift: number;
  phase: number;
}

function layout(stars: GalaxyStar[]): { placed: Placed[]; clusters: { secteur: string; cx: number; cy: number }[] } {
  const sectors = Array.from(new Set(stars.map((s) => s.secteur || "Autre")));
  const cx0 = W / 2;
  const cy0 = H / 2;
  const maxArr = Math.max(1, ...stars.map((s) => s.arr ?? 0));

  const clusters = sectors.map((secteur, i) => {
    const a = (i / Math.max(1, sectors.length)) * Math.PI * 2 - Math.PI / 2;
    const rx = sectors.length <= 1 ? 0 : 330;
    const ry = sectors.length <= 1 ? 0 : 225;
    return { secteur, cx: cx0 + Math.cos(a) * rx, cy: cy0 + Math.sin(a) * ry };
  });
  const clusterMap = new Map(clusters.map((c) => [c.secteur, c]));

  const placed: Placed[] = stars.map((s) => {
    const cl = clusterMap.get(s.secteur || "Autre")!;
    const seedA = hash(s.id);
    const seedR = hash(s.id + "r");
    const score = s.score ?? 0;
    const radius = 26 + (1 - score / 100) * 86 + seedR * 30;
    const angle = seedA * Math.PI * 2;
    const x = cl.cx + Math.cos(angle) * radius;
    const y = cl.cy + Math.sin(angle) * radius * 0.82;
    const r = 5 + Math.min(1, (s.arr ?? 0) / maxArr) * 15;
    return { ...s, x, y, r, color: stageColor(s.stage), drift: 7 + seedR * 9, phase: seedA * 4 };
  });

  // Relaxation anti-chevauchement.
  for (let iter = 0; iter < 60; iter++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i], b = placed[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.r + b.r + 16;
        if (d < min) {
          const push = (min - d) / 2;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push;
          b.x += ux * push; b.y += uy * push;
        }
      }
    }
  }
  for (const p of placed) {
    p.x = Math.max(PAD, Math.min(W - PAD, p.x));
    p.y = Math.max(PAD, Math.min(H - PAD, p.y));
  }

  return { placed, clusters };
}

export function PortfolioGalaxy({ stars }: { stars: GalaxyStar[] }) {
  const router = useRouter();
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [hovered, setHovered] = React.useState<Placed | null>(null);
  const [activeStage, setActiveStage] = React.useState<string | null>(null);
  const [fs, setFs] = React.useState(false);
  const [view, setView] = React.useState({ k: 1, tx: 0, ty: 0 });

  const { placed, clusters } = React.useMemo(() => layout(stars), [stars]);

  const links = React.useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const bySector = new Map<string, Placed[]>();
    for (const p of placed) {
      const k = p.secteur || "Autre";
      if (!bySector.has(k)) bySector.set(k, []);
      bySector.get(k)!.push(p);
    }
    bySector.forEach((arr) => {
      const sorted = [...arr].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        out.push({ x1: sorted[i].x, y1: sorted[i].y, x2: sorted[i + 1].x, y2: sorted[i + 1].y });
      }
    });
    return out;
  }, [placed]);

  const dust = React.useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        x: hash("dx" + i) * W,
        y: hash("dy" + i) * H,
        r: 0.4 + hash("dr" + i) * 1.2,
        o: 0.1 + hash("do" + i) * 0.32,
        d: hash("dd" + i) * 4,
      })),
    []
  );

  // --- conversion écran → coords viewBox ---
  function toSvg(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }

  function zoomAt(px: number, py: number, factor: number) {
    setView((v) => {
      const k = Math.max(0.6, Math.min(6, v.k * factor));
      const tx = px - (px - v.tx) * (k / v.k);
      const ty = py - (py - v.ty) * (k / v.k);
      return { k, tx, ty };
    });
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { x, y } = toSvg(e.clientX, e.clientY);
    zoomAt(x, y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }

  // --- drag / pinch ---
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const pinch = React.useRef<number | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = toSvg(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const p = toSvg(e.clientX, e.clientY);
    const dx = p.x - drag.current.x, dy = p.y - drag.current.y;
    drag.current = p;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch.current != null) {
        const mid = toSvg((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        zoomAt(mid.x, mid.y, dist / pinch.current);
      }
      pinch.current = dist;
      drag.current = null;
    }
  }
  function onTouchEnd() {
    pinch.current = null;
  }

  function reset() {
    setView({ k: 1, tx: 0, ty: 0 });
  }

  const dim = (stage: string | null) => activeStage != null && (stage ?? "Cold") !== activeStage;

  return (
    <div
      className={
        fs
          ? "fixed inset-0 z-50 bg-[hsl(232_40%_4%)] p-3"
          : "relative w-full overflow-hidden rounded-2xl border border-border/60 bg-[hsl(232_40%_5%/0.5)] shadow-glass backdrop-blur-xl"
      }
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={fs ? "h-full w-full touch-none" : "h-auto w-full touch-none"}
        style={{ display: "block", cursor: drag.current ? "grabbing" : "grab" }}
        role="img"
        aria-label="Galaxie du portefeuille"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* poussière */}
          {dust.map((d, i) => (
            <circle key={"dust" + i} cx={d.x} cy={d.y} r={d.r} fill="white" opacity={d.o}>
              <animate attributeName="opacity" values={`${d.o};${d.o * 0.25};${d.o}`} dur={`${3 + d.d}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {/* lignes de constellation */}
          {links.map((l, i) => (
            <line key={"l" + i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="hsl(250 80% 70% / 0.12)" strokeWidth={0.8} />
          ))}

          {/* labels secteurs */}
          {clusters.map((c) => (
            <text
              key={"sec" + c.secteur}
              x={c.cx}
              y={c.cy - 104}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", opacity: 0.5, fontWeight: 600 }}
            >
              {c.secteur}
            </text>
          ))}

          {/* étoiles */}
          {placed.map((p, i) => {
            const isHover = hovered?.id === p.id;
            const faded = dim(p.stage);
            return (
              <g
                key={p.id}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                style={{ opacity: faded ? 0.12 : 1, transition: "opacity .35s" }}
                onMouseEnter={() => setHovered(p)}
                onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
                onClick={() => !drag.current && router.push(`/compte/${p.id}`)}
              >
                {/* flottement vivant */}
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  additive="sum"
                  values={`0 0; ${(p.phase % 2 ? 1 : -1) * 3} ${-3}; 0 0; ${(p.phase % 2 ? -1 : 1) * 3} ${3}; 0 0`}
                  dur={`${p.drift}s`}
                  repeatCount="indefinite"
                />
                {/* halo */}
                <circle r={p.r * 2.6} fill={`hsl(${p.color} / 0.16)`} style={{ filter: "blur(6px)" }}>
                  <animate attributeName="r" from="0" to={p.r * 2.6} begin={`${i * 0.02}s`} dur="0.7s" fill="freeze" />
                </circle>
                {/* étoile */}
                <circle
                  r={p.r}
                  fill={`hsl(${p.color})`}
                  stroke={isHover ? "white" : `hsl(${p.color} / 0.4)`}
                  strokeWidth={isHover ? 2 : 1}
                  style={{ filter: `drop-shadow(0 0 ${isHover ? 16 : 8}px hsl(${p.color} / 0.9))`, transition: "stroke .2s, stroke-width .2s" }}
                >
                  <animate attributeName="r" from="0" to={p.r} begin={`${i * 0.02}s`} dur="0.6s" fill="freeze" />
                  <animate attributeName="opacity" values="1;0.78;1" dur={`${2.5 + p.phase}s`} begin={`${0.6 + (i % 7) * 0.3}s`} repeatCount="indefinite" />
                </circle>
                {(p.r > 11 || isHover) && (
                  <text y={p.r + 14} textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 600, paintOrder: "stroke", stroke: "hsl(232 40% 5%)", strokeWidth: 3 }}>
                    {p.nom}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-border/70 bg-popover/90 p-3 shadow-glow backdrop-blur-xl"
          style={{
            left: `${((hovered.x * view.k + view.tx) / W) * 100}%`,
            top: `${((hovered.y * view.k + view.ty) / H) * 100}%`,
            marginTop: -16,
          }}
        >
          <p className="font-display text-sm font-bold text-foreground">{hovered.nom}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hovered.secteur || "—"}</p>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${hovered.color})` }} />
              {hovered.stage ?? "—"}
            </span>
            <span className="font-semibold text-foreground">★ {hovered.score ?? "—"}</span>
          </div>
          {hovered.arr != null && hovered.arr > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">ARR pondéré · <span className="font-semibold text-foreground">{hovered.arr}k€</span></p>
          )}
        </div>
      )}

      {/* Contrôles zoom / plein écran */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn, fn: () => zoomAt(W / 2, H / 2, 1.25), label: "Zoom avant" },
          { icon: ZoomOut, fn: () => zoomAt(W / 2, H / 2, 1 / 1.25), label: "Zoom arrière" },
          { icon: RotateCcw, fn: reset, label: "Réinitialiser" },
          { icon: fs ? Minimize2 : Maximize2, fn: () => setFs((s) => !s), label: "Plein écran" },
        ].map(({ icon: Icon, fn, label }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            onClick={fn}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground backdrop-blur-md transition-all hover:border-primary/40 hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Légende cliquable (filtres) */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2 py-2 backdrop-blur-md">
        {Object.entries(STAGE).map(([k, c]) => {
          const on = activeStage === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActiveStage((s) => (s === k ? null : k))}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-all ${
                on ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${c})`, boxShadow: `0 0 8px hsl(${c} / 0.8)` }} />
              {k}
            </button>
          );
        })}
        {activeStage && (
          <button type="button" onClick={() => setActiveStage(null)} className="rounded-md px-2 py-1 text-[11px] text-primary hover:underline">
            tout
          </button>
        )}
      </div>
    </div>
  );
}
