/**
 * Lit la réponse fetch en texte brut, puis tente un JSON.parse.
 * Si le serveur renvoie du HTML (ex. page d'erreur Netlify sur timeout ~26s),
 * remonte un message lisible au lieu de l'erreur "Unexpected token '<'".
 */
export async function parseApiJson(
  res: Response
): Promise<{ error?: string; [key: string]: unknown }> {
  const raw = await res.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as { error?: string; [key: string]: unknown };
  } catch {
    const preview = raw.replace(/\s+/g, " ").slice(0, 200);
    const isHtml = preview.includes("<") || preview.startsWith("Internal");
    throw new Error(
      isHtml
        ? `Délai dépassé ou crash serveur (Netlify ~26s). Réessayez dans quelques instants.`
        : preview || `Erreur HTTP ${res.status}.`
    );
  }
}
