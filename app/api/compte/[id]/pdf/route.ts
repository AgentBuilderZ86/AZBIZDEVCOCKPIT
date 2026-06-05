import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getCompte360 } from "@/lib/notion";
import { resolveNextBestAction } from "@/lib/next-best-action-ai";
import { FocusComptePdf } from "@/lib/pdf/focus-compte";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** GET → PDF one-pager « Focus compte ». */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await getCompte360(params.id);
    const nba = await resolveNextBestAction(
      data.compte,
      data.contacts,
      data.opportunites,
      data.signaux
    );
    const generatedAt = new Date().toLocaleDateString("fr-FR");

    const element = React.createElement(FocusComptePdf, {
      data,
      nba,
      generatedAt,
    }) as unknown as React.ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    const safeName = (data.compte.compte || "compte")
      .normalize("NFD")
      .replace(/[^\w]+/g, "-")
      .slice(0, 40);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="focus-${safeName}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur génération PDF.";
    // eslint-disable-next-line no-console
    console.error("[compte/:id/pdf] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
