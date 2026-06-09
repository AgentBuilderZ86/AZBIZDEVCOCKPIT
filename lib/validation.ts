/** Helpers de validation d'entrée partagés (défense en profondeur). */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vrai si la chaîne est un UUID v4-like (identifiants Postgres gen_random_uuid). */
export function isUuid(v: string | undefined | null): boolean {
  return typeof v === "string" && UUID_RE.test(v);
}
