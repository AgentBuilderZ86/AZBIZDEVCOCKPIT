"use client";

import * as React from "react";
import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopilotPanel } from "./copilot-panel";
import { JournalPanel } from "./journal-panel";
import { VeillePanel } from "./veille-panel";

interface Props {
  compteId: string;
  compteName: string;
  intelligenceOn: boolean;
  copilotEnabled: boolean;
  intelligenceDisabledReason?: string;
  copilotDisabledReason?: string;
}

export function CompteIntelligenceAside({
  compteId,
  compteName,
  intelligenceOn,
  copilotEnabled,
  intelligenceDisabledReason,
  copilotDisabledReason,
}: Props) {
  const [journalRefresh, setJournalRefresh] = React.useState(0);

  if (!intelligenceOn) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <BrainCircuit className="h-4 w-4" />
            Intelligence désactivée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Le Copilote IA, la veille et le journal nécessitent :</p>
          <ul className="list-inside list-disc space-y-1">
            <li><code>DATABASE_URL</code> (Postgres)</li>
            <li><code>EMBEDDINGS_API_KEY</code></li>
          </ul>
          <p>
            Puis : <code className="rounded bg-muted px-1">npm run db:migrate</code>
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/connaissance">Indexer des documents</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <CopilotPanel
        compteId={compteId}
        compteName={compteName}
        enabled={copilotEnabled}
        disabledReason={copilotDisabledReason}
      />
      <VeillePanel
        compteId={compteId}
        enabled={intelligenceOn}
        onComplete={() => setJournalRefresh((k) => k + 1)}
      />
      <JournalPanel
        compteId={compteId}
        enabled={intelligenceOn}
        disabledReason={intelligenceDisabledReason}
        refreshKey={journalRefresh}
      />
    </>
  );
}
