import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({
      enabled: false,
      weekCount: 0,
      overdueCount: 0,
      callCount: 0,
      doneCount: 0,
    });
  }

  try {
    const db = getDb();
    const rows = await db<
      { week_cnt: string; overdue_cnt: string; call_cnt: string; done_cnt: string }[]
    >`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'pending'
            AND (due_date IS NULL OR due_date <= (date_trunc('week', now()) + interval '6 days')::date)
        ) AS week_cnt,
        COUNT(*) FILTER (
          WHERE status = 'pending' AND due_date < current_date
        ) AS overdue_cnt,
        COUNT(*) FILTER (
          WHERE status = 'pending' AND type = 'appel'
        ) AS call_cnt,
        COUNT(*) FILTER (WHERE status = 'done') AS done_cnt
      FROM taches
    `;
    const r = rows[0];
    return NextResponse.json({
      enabled: true,
      weekCount: parseInt(r?.week_cnt ?? "0", 10),
      overdueCount: parseInt(r?.overdue_cnt ?? "0", 10),
      callCount: parseInt(r?.call_cnt ?? "0", 10),
      doneCount: parseInt(r?.done_cnt ?? "0", 10),
    });
  } catch {
    return NextResponse.json({
      enabled: false,
      weekCount: 0,
      overdueCount: 0,
      callCount: 0,
      doneCount: 0,
    });
  }
}
