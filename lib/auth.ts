import "server-only";

/**
 * Couche d'abstraction auth — prête pour Clerk (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
 * Tant que Clerk n'est pas installé, toutes les fonctions retournent un user "owner" unique.
 * Remplacer les stubs par les imports Clerk lors de l'installation.
 */

export type UserRole = "admin" | "commercial" | "viewer";

export interface CurrentUser {
  userId: string;
  email: string;
  role: UserRole;
  secteurs: string[] | null; // null = accès à tous les secteurs
}

// --- Stubs pré-Clerk ---
// À remplacer par : import { auth, currentUser } from "@clerk/nextjs/server";

async function getClerkUser(): Promise<CurrentUser | null> {
  // Stub : owner unique (mode solo actuel)
  const ownerId = process.env.OWNER_USER_ID ?? "owner";
  const ownerEmail = process.env.OWNER_EMAIL ?? "azriouil.az@gmail.com";
  return { userId: ownerId, email: ownerEmail, role: "admin", secteurs: null };
}

/** Retourne l'utilisateur courant ou null si non authentifié. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return getClerkUser();
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
