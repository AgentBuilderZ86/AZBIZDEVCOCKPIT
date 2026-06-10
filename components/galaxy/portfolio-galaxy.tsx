"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Search, X } from "lucide-react";

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
const YF = 0.82; // aplatissement elliptique de la galaxie

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
  cx: number;
  cy: number;
  radius: number;
  angle0: number;
  omega: number;
}

function posAt(p: Placed, t: number): { x: number; y: number } {
  const a = p.angle0 + p.omega * t;
  return { x: p.cx + Math.cos(a) * p.radius, y: p.cy + Math.sin(a) * p.radius * YF };
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
    const angle0 = seedA * Math.PI * 2;
    const x = cl.cx + Math.cos(angle0) * radius;
    const y = cl.cy + Math.sin(angle0) * radius * YF;
    const r = 5 + Math.min(1, (s.arr ?? 0) / maxArr) * 15;
    // Vitesse angulaire type Kepler : plus lente quand l'étoile est loin du cœur.
    const dir = seedR > 0.5 ? 1 : -1;
    const omega = (dir * 0.12) / Math.sqrt(radius / 60);
    return { ...s, x, y, r, color: stageColor(s.stage), cx: cl.cx, cy: cl.cy, radius, angle0, omega };
  });

  return { placed, clusters };
}

export function PortfolioGalaxy({ stars }: { stars: GalaxyStar[] }) {
  const router = useRouter();
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const starRefs = React.useRef<Map<string, SVGGElement>>(new Map());
  const tRef = React.useRef(0);
  const hoveredIdRef = React.useRef<string | null>(null);
  const focusedIdRef = React.useRef<string | null>(null);
  const reducedRef = React.useRef(false);

  const [hovered, setHovered] = React.useState<(Placed & { lx: number; ly: number }) | null>(null);
  const [activeStage, setActiveStage] = React.useState<string | null>(null);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
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
      for (let i = 0; i < sorted.length - 1; i++) out.push({ x1: sorted[i].x, y1: sorted[i].y, x2: sorted[i + 1].x, y2: sorted[i + 1].y });
    });
    return out;
  }, [placed]);

  const dust = React.useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        x: hash("dx" + i) * W, y: hash("dy" + i) * H,
        r: 0.4 + hash("dr" + i) * 1.2, o: 0.1 + hash("do" + i) * 0.32, d: hash("dd" + i) * 4,
      })),
    []
  );

  React.useEffect(() => {
    reducedRef.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);
  React.useEffect(() => { hoveredIdRef.current = hovered?.id ?? null; }, [hovered]);
  React.useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);

  // Boucle d'animation : orbites réelles autour du cœur de secteur.
  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reducedRef.current && !document.hidden) tRef.current += dt;
      const t = tRef.current;
      for (const p of placed) {
        // L'étoile survolée / ciblée reste figée pour faciliter lecture & clic.
        if (p.id === hoveredIdRef.current || p.id === focusedIdRef.current) continue;
        const el = starRefs.current.get(p.id);
        if (el) {
          const { x, y } = posAt(p, t);
          el.setAttribute("transform", `translate(${x} ${y})`);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [placed]);

  function toSvg(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }
  function zoomAt(px: number, py: number, factor: number) {
    setView((v) => {
      const k = Math.max(0.6, Math.min(7, v.k * factor));
      return { k, tx: px - (px - v.tx) * (k / v.k), ty: py - (py - v.ty) * (k / v.k) };
    });
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const { x, y } = toSvg(e.clientX, e.clientY);
    zoomAt(x, y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }
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
  function onPointerUp() { drag.current = null; }
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
  function onTouchEnd() { pinch.current = null; }
  function reset() { setView({ k: 1, tx: 0, ty: 0 }); setFocusedId(null); }

  function focusStar(p: Placed) {
    const pos = posAt(p, tRef.current);
    const k = 2.8;
    setView({ k, tx: W / 2 - pos.x * k, ty: H / 2 - pos.y * k });
    setFocusedId(p.id);
    setQuery("");
  }

  const results = query.trim()
    ? placed.filter((p) => p.nom.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  const isFaded = (p: Placed) =>
    (activeStage != null && (p.stage ?? "Cold") !== activeStage) || (focusedId != null && p.id !== focusedId);

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
          {dust.map((d, i) => (
            <circle key={"dust" + i} cx={d.x} cy={d.y} r={d.r} fill="white" opacity={d.o}>
              <animate attributeName="opacity" values={`${d.o};${d.o * 0.25};${d.o}`} dur={`${3 + d.d}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {links.map((l, i) => (
            <line key={"l" + i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="hsl(250 80% 70% / 0.10)" strokeWidth={0.8} />
          ))}

          {clusters.map((c) => (
            <text key={"sec" + c.secteur} x={c.cx} y={c.cy - 118} textAnchor="middle" className="fill-muted-foreground"
              style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", opacity: 0.45, fontWeight: 600 }}>
              {c.secteur}
            </text>
          ))}

          {placed.map((p, i) => {
            const isHover = hovered?.id === p.id;
            const isFocus = focusedId === p.id;
            return (
              <g
                key={p.id}
                ref={(el) => { if (el) starRefs.current.set(p.id, el); else starRefs.current.delete(p.id); }}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                style={{ opacity: isFaded(p) ? 0.1 : 1, transition: "opacity .35s" }}
                onMouseEnter={() => setHovered({ ...p, ...posAt(p, tRef.current), lx: posAt(p, tRef.current).x, ly: posAt(p, tRef.current).y })}
                onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
                onClick={() => !drag.current && router.push(`/compte/${p.id}`)}
              >
                {(isFocus || isHover) && (
                  <circle r={p.r + 9} fill="none" stroke="white" strokeWidth={1} opacity={0.7} className="animate-glow-pulse" />
                )}
                <circle r={p.r * 2.6} fill={`hsl(${p.color} / 0.16)`} style={{ filter: "blur(6px)" }}>
                  <animate attributeName="r" from="0" to={p.r * 2.6} begin={`${i * 0.02}s`} dur="0.7s" fill="freeze" />
                </circle>
                <circle
                  r={p.r}
                  fill={`hsl(${p.color})`}
                  stroke={isHover || isFocus ? "white" : `hsl(${p.color} / 0.4)`}
                  strokeWidth={isHover || isFocus ? 2 : 1}
                  style={{ filter: `drop-shadow(0 0 ${isHover || isFocus ? 16 : 8}px hsl(${p.color} / 0.9))`, transition: "stroke .2s, stroke-width .2s" }}
                >
                  <animate attributeName="r" from="0" to={p.r} begin={`${i * 0.02}s`} dur="0.6s" fill="freeze" />
                  <animate attributeName="opacity" values="1;0.78;1" dur={`${2.5 + (p.angle0 % 4)}s`} begin={`${0.6 + (i % 7) * 0.3}s`} repeatCount="indefinite" />
                </circle>
                {(p.r > 11 || isHover || isFocus) && (
                  <text y={p.r + 14} textAnchor="middle" className="fill-foreground"
                    style={{ fontSize: 12, fontWeight: 600, paintOrder: "stroke", stroke: "hsl(232 40% 5%)", strokeWidth: 3 }}>
                    {p.nom}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Recherche */}
      <div className="absolute left-3 top-3 w-56">
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 backdrop-blur-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un compte…"
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          {(query || focusedId) && (
            <button type="button" aria-label="Effacer" onClick={() => { setQuery(""); setFocusedId(null); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {results.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-lg border border-border/60 bg-popover/95 backdrop-blur-xl">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => focusStar(p)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-primary/10"
              >
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: `hsl(${p.color})` }} />
                <span className="truncate">{p.nom}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">★ {p.score ?? "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-border/70 bg-popover/90 p-3 shadow-glow backdrop-blur-xl"
          style={{
            left: `${((hovered.lx * view.k + view.tx) / W) * 100}%`,
            top: `${((hovered.ly * view.k + view.ty) / H) * 100}%`,
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

      {/* Contrôles */}
      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn, fn: () => zoomAt(W / 2, H / 2, 1.25), label: "Zoom avant" },
          { icon: ZoomOut, fn: () => zoomAt(W / 2, H / 2, 1 / 1.25), label: "Zoom arrière" },
          { icon: RotateCcw, fn: reset, label: "Réinitialiser" },
          { icon: fs ? Minimize2 : Maximize2, fn: () => setFs((s) => !s), label: "Plein écran" },
        ].map(({ icon: Icon, fn, label }) => (
          <button key={label} type="button" aria-label={label} onClick={fn}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground backdrop-blur-md transition-all hover:border-primary/40 hover:text-foreground">
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Légende = filtres */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 rounded-lg border border-border/50 bg-background/50 px-2 py-2 backdrop-blur-md">
        {Object.entries(STAGE).map(([k, c]) => {
          const on = activeStage === k;
          return (
            <button key={k} type="button" onClick={() => setActiveStage((s) => (s === k ? null : k))}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-all ${on ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${c})`, boxShadow: `0 0 8px hsl(${c} / 0.8)` }} />
              {k}
            </button>
          );
        })}
        {activeStage && (
          <button type="button" onClick={() => setActiveStage(null)} className="rounded-md px-2 py-1 text-[11px] text-primary hover:underline">tout</button>
        )}
      </div>
    </div>
  );
}
