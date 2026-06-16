import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Sécurité globale de l'application :
 *  - Routes serveur-à-serveur (cron, background) : exclues de Clerk, protégées par CRON_SECRET.
 *  - Toutes les autres routes (pages + API) : authentification Clerk obligatoire.
 *  - Allowlist e-mail (défense en profondeur) via ALLOWED_EMAILS / OWNER_EMAIL.
 *  - Rate-limiting best-effort sur /api/* pour limiter l'abus (drain de crédits, DoS).
 */

const isCronRoute = createRouteMatcher([
  "/api/cron(.*)",
  "/api/enrich-intel-bg",
  "/api/procurement-bg",
  "/api/networking-bg",
]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const allowedEmails = (process.env.ALLOWED_EMAILS ?? process.env.OWNER_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-nf-client-connection-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export default clerkMiddleware(async (auth, req) => {
  // Les routes cron/background s'authentifient via CRON_SECRET, pas Clerk.
  if (isCronRoute(req)) return NextResponse.next();

  // Rate-limit large (Edge, en mémoire) sur l'API. Les routes coûteuses ont en plus
  // un quota Upstash robuste (cf. lib/rate-limit-upstash.ts).
  if (isApiRoute(req)) {
    const ok = rateLimit(`${clientIp(req)}:api`);
    if (!ok) {
      return NextResponse.json(
        { error: "Trop de requêtes. Réessaie dans un instant." },
        { status: 429 }
      );
    }
  }

  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    if (isApiRoute(req)) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }
    return (await auth()).redirectToSignIn({ returnBackUrl: req.url });
  }

  // Allowlist e-mail (si l'e-mail est présent dans les claims de session).
  // Pour l'activer, ajouter dans Clerk un JWT template incluant {"email": "{{user.primary_email_address}}"}.
  if (allowedEmails.length > 0) {
    const email = (
      (sessionClaims as Record<string, unknown> | null)?.email ?? ""
    )
      .toString()
      .toLowerCase();
    if (email && !allowedEmails.includes(email)) {
      if (isApiRoute(req)) {
        return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
      }
      return new NextResponse("Accès refusé.", { status: 403 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Tout sauf les assets statiques internes Next et les fichiers à extension.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webmanifest|txt)$).*)",
    "/(api|trpc)(.*)",
  ],
};
