import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";
import { listComptes } from "@/lib/notion";

const EMPTY = {
  enabled: false,
  weeklyCount: 0,
  weeklyTarget: 10,
  weeklyStreak: 0,
  monthlyCount: 0,
  monthlyPrevious: 0,
  coveragePercent: 0,
  dormantAccounts: [] as { id: string; name: string; daysSinceLastInteraction: number }[],
};

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(EMPTY);
  }

  try {
    const db = getDb();

    const [
      comptes,
      weekRows,
      monthRows,
      prevMonthRows,
      coverageRows,
      weeklyHistoryRows,
      lastInteractionRows,
    ] = await Promise.all([
      listComptes().catch(() => [] as Awaited<ReturnType<typeof listComptes>>),
      db<{ cnt: string }[]>`
        SELECT COUNT(*) AS cnt
        FROM account_journal
        WHERE source = 'manuel'
          AND event_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
      `,
      db<{ cnt: string }[]>`
        SELECT COUNT(*) AS cnt
        FROM account_journal
        WHERE source = 'manuel'
          AND event_date >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      `,
      db<{ cnt: string }[]>`
        SELECT COUNT(*) AS cnt
        FROM account_journal
        WHERE source = 'manuel'
          AND event_date >= date_trunc('month', NOW() AT TIME ZONE 'UTC') - interval '1 month'
          AND event_date < date_trunc('month', NOW() AT TIME ZONE 'UTC')
      `,
      db<{ account_url: string }[]>`
        SELECT DISTINCT account_url
        FROM account_journal
        WHERE source = 'manuel'
          AND event_date >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
      `,
      db<{ week_start: Date; cnt: string }[]>`
        SELECT
          date_trunc('week', event_date AT TIME ZONE 'UTC') AS week_start,
          COUNT(*) AS cnt
        FROM account_journal
        WHERE source = 'manuel'
          AND event_date >= NOW() - interval '8 weeks'
        GROUP BY date_trunc('week', event_date AT TIME ZONE 'UTC')
        ORDER BY week_start DESC
      `,
      db<{ account_url: string; last_interaction: Date }[]>`
        SELECT account_url, MAX(event_date) AS last_interaction
        FROM account_journal
        WHERE source = 'manuel'
        GROUP BY account_url
      `,
    ]);

    const activeAccounts = comptes.filter(
      (c) => c.stage !== "Lost" && c.statutRelation !== "Dormante"
    );

    const weeklyTarget = Math.max(5, Math.ceil(activeAccounts.length * 1.5));
    const weeklyCount = parseInt(weekRows[0]?.cnt ?? "0", 10);
    const monthlyCount = parseInt(monthRows[0]?.cnt ?? "0", 10);
    const monthlyPrevious = parseInt(prevMonthRows[0]?.cnt ?? "0", 10);

    // Coverage: % active accounts with ≥1 manual interaction this week
    const coveredUrls = new Set(coverageRows.map((r) => r.account_url));
    const coveragePercent =
      activeAccounts.length > 0
        ? Math.round(
            (activeAccounts.filter((c) => coveredUrls.has(c.url)).length /
              activeAccounts.length) *
              100
          )
        : 0;

    // Streak: consecutive past weeks reaching ≥80% of target
    const currentWeekStart = new Date();
    currentWeekStart.setDate(
      currentWeekStart.getDate() - currentWeekStart.getDay()
    );
    currentWeekStart.setHours(0, 0, 0, 0);

    const weekMap = new Map(
      weeklyHistoryRows.map((r) => [
        new Date(r.week_start).toISOString().slice(0, 10),
        parseInt(r.cnt, 10),
      ])
    );

    let weeklyStreak = 0;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - i * 7);
      const key = d.toISOString().slice(0, 10);
      const cnt = weekMap.get(key) ?? 0;
      if (cnt >= weeklyTarget * 0.8) weeklyStreak++;
      else break;
    }

    // Dormant accounts: active comptes without manual interaction in 14+ days
    const lastInteractionMap = new Map(
      lastInteractionRows.map((r) => [r.account_url, r.last_interaction])
    );
    const now = new Date();

    const dormantAccounts = activeAccounts
      .map((c) => {
        const last = lastInteractionMap.get(c.url);
        const daysSinceLastInteraction = last
          ? Math.floor(
              (now.getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 999;
        return { id: c.id, name: c.compte || "—", daysSinceLastInteraction };
      })
      .filter((a) => a.daysSinceLastInteraction > 14)
      .sort((a, b) => b.daysSinceLastInteraction - a.daysSinceLastInteraction)
      .slice(0, 5);

    return NextResponse.json({
      enabled: true,
      weeklyCount,
      weeklyTarget,
      weeklyStreak,
      monthlyCount,
      monthlyPrevious,
      coveragePercent,
      dormantAccounts,
    });
  } catch (err) {
    console.error("[effort-stats]", err);
    return NextResponse.json(EMPTY);
  }
}
