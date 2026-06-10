"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
const PAD = 70;

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

/** Hash déterministe → [0,1) pour un placement stable. */
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
  twinkle: number;
}

function layout(stars: GalaxyStar[]): { placed: Placed[]; clusters: { secteur: string; cx: number; cy: number }[] } {
  const sectors = Array.from(new Set(stars.map((s) => s.secteur || "Autre")));
  const cx0 = W / 2;
  const cy0 = H / 2;
  const maxArr = Math.max(1, ...stars.map((s) => s.arr ?? 0));

  // Centres de constellations répartis sur une ellipse.
  const clusters = sectors.map((secteur, i) => {
    const a = (i / Math.max(1, sectors.length)) * Math.PI * 2 - Math.PI / 2;
    const rx = sectors.length <= 1 ? 0 : 300;
    const ry = sectors.length <= 1 ? 0 : 215;
    return { secteur, cx: cx0 + Math.cos(a) * rx, cy: cy0 + Math.sin(a) * ry };
  });
  const clusterMap = new Map(clusters.map((c) => [c.secteur, c]));

  const placed: Placed[] = stars.map((s) => {
    const cl = clusterMap.get(s.secteur || "Autre")!;
    const seedA = hash(s.id);
    const seedR = hash(s.id + "r");
    const score = s.score ?? 0;
    // Score élevé → plus proche du cœur de la constellation.
    const radius = 22 + (1 - score / 100) * 78 + seedR * 26;
    const angle = seedA * Math.PI * 2;
    let x = cl.cx + Math.cos(angle) * radius;
    let y = cl.cy + Math.sin(angle) * radius * 0.82;
    x = Math.max(PAD, Math.min(W - PAD, x));
    y = Math.max(PAD, Math.min(H - PAD, y));
    const r = 5 + Math.min(1, (s.arr ?? 0) / maxArr) * 15;
    return { ...s, x, y, r, color: stageColor(s.stage), twinkle: 2.5 + seedA * 3 };
  });

  return { placed, clusters };
}

export function PortfolioGalaxy({ stars }: { stars: GalaxyStar[] }) {
  const router = useRouter();
  const [hovered, setHovered] = React.useState<Placed | null>(null);
  const { placed, clusters } = React.useMemo(() => layout(stars), [stars]);

  // Lignes de constellation : relie les étoiles d'un secteur par score décroissant.
  const links = React.useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const bySector = new Map<string, Placed[]>();
    for (const p of placed) {
      const k = p.secteur || "Autre";
      (bySector.get(k) ?? bySector.set(k, []).get(k)!).push(p);
    }
    bySector.forEach((arr) => {
      const sorted = [...arr].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      for (let i = 0; i < sorted.length - 1; i++) {
        out.push({ x1: sorted[i].x, y1: sorted[i].y, x2: sorted[i + 1].x, y2: sorted[i + 1].y });
      }
    });
    return out;
  }, [placed]);

  // Poussière d'étoiles décorative (déterministe).
  const dust = React.useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: hash("dx" + i) * W,
        y: hash("dy" + i) * H,
        r: 0.4 + hash("dr" + i) * 1.1,
        o: 0.12 + hash("do" + i) * 0.3,
        d: hash("dd" + i) * 4,
      })),
    []
  );

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-[hsl(232_40%_5%/0.5)] shadow-glass backdrop-blur-xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ display: "block" }} role="img" aria-label="Galaxie du portefeuille">
        {/* poussière */}
        {dust.map((d, i) => (
          <circle key={"dust" + i} cx={d.x} cy={d.y} r={d.r} fill="white" opacity={d.o}>
            <animate attributeName="opacity" values={`${d.o};${d.o * 0.3};${d.o}`} dur={`${3 + d.d}s`} repeatCount="indefinite" />
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
            y={c.cy - 96}
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
          return (
            <g
              key={p.id}
              transform={`translate(${p.x} ${p.y})`}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered((h) => (h?.id === p.id ? null : h))}
              onClick={() => router.push(`/compte/${p.id}`)}
            >
              {/* halo */}
              <circle r={p.r * 2.6} fill={`hsl(${p.color} / 0.16)`} style={{ filter: "blur(6px)" }} />
              {/* étoile */}
              <circle
                r={p.r}
                fill={`hsl(${p.color})`}
                stroke={isHover ? "white" : `hsl(${p.color} / 0.4)`}
                strokeWidth={isHover ? 2 : 1}
                style={{ filter: `drop-shadow(0 0 ${isHover ? 14 : 8}px hsl(${p.color} / 0.9))`, transition: "all .2s" }}
              >
                <animate attributeName="opacity" values="1;0.78;1" dur={`${p.twinkle}s`} begin={`${(i % 7) * 0.3}s`} repeatCount="indefinite" />
              </circle>
              {/* nom pour les grosses étoiles ou au survol */}
              {(p.r > 11 || isHover) && (
                <text y={p.r + 14} textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 600, paintOrder: "stroke", stroke: "hsl(232 40% 5%)", strokeWidth: 3 }}>
                  {p.nom}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip riche */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 w-52 -translate-x-1/2 -translate-y-full rounded-xl border border-border/70 bg-popover/90 p-3 shadow-glow backdrop-blur-xl"
          style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, marginTop: -16 }}
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

      {/* Légende */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border/50 bg-background/50 px-3 py-2 backdrop-blur-md">
        {Object.entries(STAGE).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: `hsl(${c})`, boxShadow: `0 0 8px hsl(${c} / 0.8)` }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
