import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { listPortfolioFeed } from "@/lib/intelligence/journal";
import { listComptes } from "@/lib/notion";
import type { JournalEventType } from "@/lib/intelligence/journal";

export const dynamic = "force-dynamic";

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "en", "à", "au", "aux",
  "pour", "par", "sur", "dans", "avec", "sans", "son", "sa", "ses", "leur", "leurs",
  "ce", "cette", "ces", "qui", "que", "quoi", "dont", "est", "sont", "plus", "via",
  "the", "of", "and", "for", "to", "a", "an", "new", "maroc", "groupe", "group",
  "millions", "milliards", "mad", "dh", "eur", "2024", "2025", "2026",
]);

function topKeywords(titles: string[], n = 4): string[] {
  const counts = new Map<string, number>();
  for (const t of titles) {
    const tokens = t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
    for (const w of new Set(tokens)) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

export async function GET(req: NextRequest) {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ enabled: false, items: [], trends: [] });
  }

  const sp = req.nextUrl.searchParams;
  const sinceDays = Number(sp.get("sinceDays")) || 30;
  const typeParam = sp.get("types");
  const types = typeParam
    ? (typeParam.split(",").filter(Boolean) as JournalEventType[])
    : undefined;

  try {
    const [events, comptes] = await Promise.all([
      listPortfolioFeed({ sinceDays, types, limit: 150 }),
      listComptes().catch(() => []),
    ]);

    const byId = new Map(comptes.map((c) => [c.id, c]));

    const items = events.map((e) => {
      const c = e.accountId ? byId.get(e.accountId) : undefined;
      const p = e.payload as Record<string, unknown>;
      return {
        id: e.id,
        eventType: e.eventType,
        source: e.source,
        eventDate: e.eventDate.toISOString(),
        accountId: e.accountId,
        compte: c?.compte ?? "Compte",
        secteur: c?.secteur ?? "Autre",
        stage: c?.stage ?? null,
        title: typeof p.title === "string" ? p.title : "",
        summary: typeof p.summary === "string" ? p.summary : "",
        url: typeof p.url === "string" ? p.url : null,
        // score_change / stage_change
        from: p.from ?? null,
        to: p.to ?? null,
      };
    });

    // ── Tendances sectorielles (sur les signaux uniquement) ──
    const bySector = new Map<string, { titles: string[]; comptes: Set<string>; count: number }>();
    for (const it of items) {
      if (it.eventType !== "signal") continue;
      const key = it.secteur || "Autre";
      if (!bySector.has(key)) bySector.set(key, { titles: [], comptes: new Set(), count: 0 });
      const agg = bySector.get(key)!;
      agg.count++;
      if (it.title) agg.titles.push(it.title);
      agg.comptes.add(it.compte);
    }
    const trends = Array.from(bySector.entries())
      .filter(([, v]) => v.count >= 3 && v.comptes.size >= 2)
      .map(([secteur, v]) => ({
        secteur,
        count: v.count,
        comptes: Array.from(v.comptes).slice(0, 6),
        keywords: topKeywords(v.titles),
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ enabled: true, items, trends, generatedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur feed." },
      { status: 500 }
    );
  }
}
