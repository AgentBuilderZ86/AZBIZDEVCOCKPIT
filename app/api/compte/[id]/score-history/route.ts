import { NextRequest, NextResponse } from "next/server";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";
import { getDb } from "@/lib/intelligence/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Retourne les 30 derniers points de score + dernières features. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isIntelligenceEnabled()) {
    return NextResponse.json({ error: "Intelligence désactivée." }, { status: 503 });
  }

  try {
    const db = getDb();

    type HistRow = {
      score: number;
      scored_at: string;
      features: Record<string, unknown>;
      weights: Record<string, unknown>;
    };

    const rows = await db<HistRow[]>`
      SELECT score, scored_at, features, weights
      FROM score_history
      WHERE account_id = ${params.id}
      ORDER BY scored_at DESC
      LIMIT 30
    `;

    if (rows.length === 0) {
      return NextResponse.json({ history: [], latest: null });
    }

    const latest = rows[0];
    const history = rows.map((r) => ({
      score: r.score,
      scoredAt: r.scored_at,
    }));

    // Breakdown from features
    const f = latest.features;
    const w = latest.weights as { mode?: string; sampleWon?: number; sampleLost?: number };

    const stageScore = stageBase(String(f.stage ?? ""));
    const prioriteScore = prioriteBonus(String(f.priorite ?? ""));
    const effectifScore = effectifBonusFn(Number(f.effectif ?? 0));
    const arrScore = Number(f.arrPondereBonus ?? 0);
    const signalsScore = Number(f.signalsBonus ?? 0);
    const statutScore = statutBonus(String(f.statutRelation ?? ""));

    const breakdown = [
      { label: "Stage", value: stageScore, max: 92 },
      { label: "Priorité", value: prioriteScore, max: 20 },
      { label: "Effectif", value: effectifScore, max: 15 },
      { label: "ARR pondéré", value: arrScore, max: 15 },
      { label: "Signaux", value: signalsScore, max: 15 },
      { label: "Statut relation", value: statutScore, max: 5 },
    ];

    const heuristic = Number(f.heuristic ?? latest.score);
    const blended = Number(f.blended ?? latest.score);
    const learnedDelta = Number(f.learnedDelta ?? 0);
    const modelMode = w.mode ?? "heuristic_v1";
    const sampleWon = w.sampleWon ?? 0;
    const sampleLost = w.sampleLost ?? 0;

    return NextResponse.json({
      history,
      latest: {
        score: latest.score,
        scoredAt: latest.scored_at,
        breakdown,
        heuristic,
        blended,
        learnedDelta,
        modelMode,
        sampleWon,
        sampleLost,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function stageBase(stage: string): number {
  const map: Record<string, number> = {
    Cold: 12, Warm: 32, Hot: 58, Active: 72, Won: 92, Lost: 5,
  };
  return map[stage] ?? 12;
}

function prioriteBonus(priorite: string): number {
  if (priorite.includes("Haute")) return 20;
  if (priorite.includes("Moyenne")) return 10;
  if (priorite.includes("Basse")) return 2;
  return 0;
}

function effectifBonusFn(effectif: number): number {
  if (!effectif) return 0;
  if (effectif >= 5000) return 15;
  if (effectif >= 1000) return 10;
  if (effectif >= 200) return 5;
  return 2;
}

function statutBonus(statut: string): number {
  if (statut === "Active") return 5;
  if (statut === "Dormante") return -20;
  return 0;
}
