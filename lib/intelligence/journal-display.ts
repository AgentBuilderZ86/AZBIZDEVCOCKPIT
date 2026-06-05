/** Libellés et formatage des événements journal (client + serveur). */

const EVENT_LABELS: Record<string, string> = {
  interaction: "Interaction",
  signal: "Signal",
  stage_change: "Changement",
  note: "Note",
  opp_update: "Opportunité",
  enrichment: "Enrichissement",
  score_change: "Score",
  action_done: "Action",
};

const SOURCE_LABELS: Record<string, string> = {
  manuel: "Saisie manuelle",
  apollo: "Apollo",
  news: "Veille",
  notion_sync: "Notion",
  cron: "Cron",
  enrichment: "Enrichissement",
};

export function journalEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType;
}

export function journalSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function formatJournalPayload(
  eventType: string,
  payload: Record<string, unknown>
): string {
  const note =
    typeof payload.note === "string"
      ? payload.note
      : typeof payload.text === "string"
        ? payload.text
        : "";
  if (note.trim()) return note.trim();

  if (eventType === "score_change") {
    const from = payload.from;
    const to = payload.to ?? payload.value;
    if (from != null && to != null) return `★ ${from} → ${to}`;
    if (to != null) return `Score : ${to}`;
  }

  if (eventType === "stage_change" && payload.field) {
    return `${String(payload.field)} : ${String(payload.value ?? "—")}`;
  }

  if (eventType === "enrichment") {
    const parts: string[] = [];
    if (payload.updatedCompte) parts.push("compte mis à jour");
    const cc = Number(payload.contactsCreated ?? 0);
    const cu = Number(payload.contactsUpdated ?? 0);
    const sc = Number(payload.signauxCreated ?? 0);
    if (cc) parts.push(`${cc} contact(s) créé(s)`);
    if (cu) parts.push(`${cu} contact(s) maj`);
    if (sc) parts.push(`${sc} signal(aux)`);
    if (parts.length) return parts.join(" · ");
  }

  if (eventType === "signal" && payload.count) {
    return `${payload.count} signal(aux) via ${String(payload.via ?? "—")}`;
  }

  const raw = JSON.stringify(payload);
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw === "{}" ? "—" : raw;
}
