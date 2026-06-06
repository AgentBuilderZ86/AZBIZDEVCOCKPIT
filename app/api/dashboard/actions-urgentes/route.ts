import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ enabled: false, pendingCount: 0, j7Count: 0, doneCount: 0 });
  }

  try {
    const db = getDb();
    const rows = await db<{ pending_cnt: string; j7_cnt: string; done_cnt: string }[]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')                           AS pending_cnt,
        COUNT(*) FILTER (WHERE status = 'pending' AND horizon = 'J+7')       AS j7_cnt,
        COUNT(*) FILTER (WHERE status = 'done')                              AS done_cnt
      FROM revue_actions
    `;
    const r = rows[0];
    return NextResponse.json({
      enabled:      true,
      pendingCount: parseInt(r?.pending_cnt ?? "0", 10),
      j7Count:      parseInt(r?.j7_cnt ?? "0", 10),
      doneCount:    parseInt(r?.done_cnt ?? "0", 10),
    });
  } catch {
    return NextResponse.json({ enabled: false, pendingCount: 0, j7Count: 0, doneCount: 0 });
  }
}
