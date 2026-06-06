import { listComptes, listAllOpportunites } from "@/lib/notion";
import { PartnerReviewClient } from "@/components/revue/partner-review-client";

export const dynamic = "force-dynamic";

export default async function RevuePartnersPage() {
  const [comptes, opportunites] = await Promise.all([
    listComptes(),
    listAllOpportunites(),
  ]);

  return (
    <main className="container mx-auto max-w-7xl py-5 px-4">
      <header className="mb-6">
        <div
          className="mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "linear-gradient(135deg, hsl(231 72% 38% / 0.08) 0%, hsl(231 60% 55% / 0.05) 100%)",
            border: "1px solid hsl(231 72% 38% / 0.18)",
            color: "hsl(231 72% 36%)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          Adil BizDev OS · Revue Mensuelle
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Revue Partners</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
          Synthèse mensuelle du plan de comptes — pipeline, insights stratégiques, points d&apos;escalade pour Iliass &amp; Sébastien.
        </p>
      </header>

      <PartnerReviewClient comptes={comptes} opportunites={opportunites} />
    </main>
  );
}
