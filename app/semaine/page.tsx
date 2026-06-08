import Link from "next/link";
import { ArrowLeft, CalendarCheck } from "lucide-react";
import { SemaineClient } from "@/components/semaine/semaine-client";
import { isIntelligenceEnabled } from "@/lib/intelligence/config";

export const dynamic = "force-dynamic";

export default function SemainePage() {
  const intelligenceOn = isIntelligenceEnabled();

  return (
    <main className="container mx-auto max-w-4xl py-6 px-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Cockpit
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarCheck className="h-6 w-6 text-primary" /> Ma semaine
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          TODO &amp; appels à réaliser — consolidés depuis les fiches comptes, contacts et opportunités.
        </p>
      </header>

      {intelligenceOn ? (
        <SemaineClient />
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50/40 p-4 text-sm text-amber-800">
          Module intelligence inactif — configurez <code>DATABASE_URL</code> puis lancez{" "}
          <code>npm run db:migrate</code>.
        </div>
      )}
    </main>
  );
}
