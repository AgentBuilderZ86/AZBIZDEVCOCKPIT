"use client";

import * as React from "react";
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
