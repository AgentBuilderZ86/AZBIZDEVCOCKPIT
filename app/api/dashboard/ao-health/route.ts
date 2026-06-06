import { NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ enabled: false, enCours: 0, budgetTotal: 0, urgentCount: 0, goCount: 0, wonCount: 0 });
  }

  try {
    const db = getDb();
    const rows = await db<{ cnt: string; budget: string; urgent: string; go_cnt: string; won: string }[]>`
      SELECT
        COUNT(*) FILTER (WHERE statut NOT IN ('PW','PL','BO_NOGO'))            AS cnt,
        COALESCE(SUM(budget_k_eur) FILTER (WHERE statut NOT IN ('PW','PL','BO_NOGO')), 0) AS budget,
        COUNT(*) FILTER (WHERE statut NOT IN ('PW','PL','BO_NOGO') AND deadline <= CURRENT_DATE + 30) AS urgent,
        COUNT(*) FILTER (WHERE suggestion = 'Go' AND statut NOT IN ('PW','PL','BO_NOGO'))  AS go_cnt,
        COUNT(*) FILTER (WHERE statut = 'PW')                                  AS won
      FROM ao_submissions
    `;
    const r = rows[0];
    return NextResponse.json({
      enabled: true,
      enCours:     parseInt(r?.cnt ?? "0", 10),
      budgetTotal: parseFloat(r?.budget ?? "0"),
      urgentCount: parseInt(r?.urgent ?? "0", 10),
      goCount:     parseInt(r?.go_cnt ?? "0", 10),
      wonCount:    parseInt(r?.won ?? "0", 10),
    });
  } catch {
    return NextResponse.json({ enabled: false, enCours: 0, budgetTotal: 0, urgentCount: 0, goCount: 0, wonCount: 0 });
  }
}
