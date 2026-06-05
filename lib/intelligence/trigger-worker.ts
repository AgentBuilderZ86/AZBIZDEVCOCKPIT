import "server-only";

/** Déclenche le worker jobs (même site, CRON_SECRET). */
export function triggerJobWorker(limit = 1): void {
  const secret = process.env.CRON_SECRET?.trim();
  const base =
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!secret || !base) return;
  void fetch(
    `${base.replace(/\/$/, "")}/api/cron/jobs?limit=${limit}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    }
  ).catch(() => {});
}
