import { NextRequest, NextResponse } from "next/server";

/**
 * Vérifie l'autorisation des endpoints cron.
 * En production : CRON_SECRET obligatoire.
 */
export function assertCronAuthorized(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET manquant en production. Configurez-le dans Netlify (Environment variables).",
      },
      { status: 503 }
    );
  }

  if (!secret) return null;

  const auth = req.headers.get("authorization");
  const provided =
    auth?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("key");

  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  return null;
}
