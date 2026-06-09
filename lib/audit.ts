/**
 * Audit léger des écritures Notion (console structurée).
 * En production Vercel, ces logs sont consultables dans les Function Logs.
 */

type AuditAction = "create" | "update" | "archive";

// Champs potentiellement PII : on logge leur présence (clé) mais pas la valeur.
const PII_KEYS = new Set([
  "email",
  "telephone",
  "linkedin",
  "notes",
  "nomComplet",
  "prenom",
  "nom",
  "texte",
  "managerId",
]);

/** Remplace les valeurs PII par un marqueur, ne conserve que les noms de champs. */
function redact(diff: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(diff)) {
    out[k] = PII_KEYS.has(k) && v != null && v !== "" ? "[redacted]" : v;
  }
  return out;
}

export function logWriteback(
  action: AuditAction,
  pageId: string,
  diff: Record<string, unknown>
) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      type: "notion_writeback",
      action,
      pageId,
      diff: redact(diff),
      at: new Date().toISOString(),
    })
  );
}
