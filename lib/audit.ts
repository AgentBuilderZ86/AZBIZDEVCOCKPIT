/**
 * Audit léger des écritures Notion (console structurée).
 * En production Vercel, ces logs sont consultables dans les Function Logs.
 */

type AuditAction = "create" | "update" | "archive";

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
      diff,
      at: new Date().toISOString(),
    })
  );
}
