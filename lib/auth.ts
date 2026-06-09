import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Couche d'abstraction auth (Clerk).
 * L'authentification est imposée globalement par `middleware.ts` ; ces helpers
 * servent à récupérer l'utilisateur côté serveur et à appliquer une logique de rôle.
 */

export type UserRole = "admin" | "commercial" | "viewer";

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
  secteurs: string[] | null; // null = accès à tous les secteurs
}

const allowedEmails = (process.env.ALLOWED_EMAILS ?? process.env.OWNER_EMAIL ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Retourne l'utilisateur courant Clerk ou null si non authentifié / non autorisé. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = (
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    ""
  ).toLowerCase();

  // Défense en profondeur : refuser si une allowlist est définie et l'e-mail n'y est pas.
  if (allowedEmails.length > 0 && email && !allowedEmails.includes(email)) {
    return null;
  }

  return { userId, email, role: "admin", secteurs: null };
}

/** Garde pour route handler : retourne l'utilisateur ou lance une erreur (401/403). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Non authentifié.");
  return user;
}

/** Lance une erreur si l'utilisateur n'a pas l'un des rôles requis. */
export function assertRole(user: CurrentUser | null, roles: UserRole[]): void {
  if (!user) throw new Error("Non authentifié.");
  if (!roles.includes(user.role)) {
    throw new Error(`Accès refusé. Rôle requis : ${roles.join(" ou ")}.`);
  }
}

/** Retourne true si l'utilisateur peut écrire sur ce secteur. */
export function canWrite(user: CurrentUser, secteur: string | null): boolean {
  if (user.role === "admin") return true;
  if (user.role === "viewer") return false;
  if (!secteur) return true;
  if (!user.secteurs) return true; // accès tous secteurs
  return user.secteurs.includes(secteur);
}
