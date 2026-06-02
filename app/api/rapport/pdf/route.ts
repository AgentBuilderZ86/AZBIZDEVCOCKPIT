import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { listComptes } from "@/lib/notion";
import { RapportPortefeuillePdf } from "@/lib/pdf/rapport-portefeuille";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** GET → PDF « Rapport portefeuille ». */
export async function GET(_req: NextRequest) {
  try {
    const comptes = await listComptes();
    const generatedAt = new Date().toLocaleDateString("fr-FR");

    const element = React.createElement(RapportPortefeuillePdf, {
      comptes,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-portefeuille.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur génération PDF.";
    // eslint-disable-next-line no-console
    console.error("[rapport/pdf] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
