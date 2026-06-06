import { NextResponse } from "next/server";
import { getOffreSynthesis } from "@/lib/intelligence/offre-analysis";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  if (!isIntelligenceEnabled()) {
    return NextResponse.json(
      { error: "Couche Intelligence inactive (DATABASE_URL)." },
      { status: 503 }
    );
  }

  try {
    const synthesis = await getOffreSynthesis();
    if (!synthesis) {
      return NextResponse.json({
        synthesis: null,
        message:
          "Aucune analyse générée. Sur chaque fiche compte, lancez « Offre Mapping & Plan d'Action » pour alimenter cette vue.",
      });
    }
    return NextResponse.json({ synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur synthèse.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
