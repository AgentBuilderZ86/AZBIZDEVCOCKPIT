import "server-only";
import { integrations } from "../config";
import type { Compte } from "../types";

/** Fire-and-forget — appelé avec void ... .catch(() => {}). */

export type AlertCompte = Pick<Compte, "id" | "url"> & {
  compte?: string;
  secteur?: Compte["secteur"];
  priorite?: Compte["priorite"];
  scoreAdilStar?: Compte["scoreAdilStar"];
  stage?: Compte["stage"];
};

function postSlack(body: Record<string, unknown>): Promise<void> {
  const url = integrations.slackWebhookUrl;
  if (!url) return Promise.resolve();
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

function accountLink(compte: AlertCompte): string {
  const name = compte.compte ?? compte.id;
  return compte.url
    ? `<${compte.url}|${name}>`
    : `*${name}*`;
}

/** Alerte si variation de score ≥ |delta| pts (appelée par le cron). */
export function alertScoreChange(
  compte: AlertCompte,
  from: number | null,
  to: number
): Promise<void> {
  const delta = to - (from ?? 0);
  if (Math.abs(delta) < 10) return Promise.resolve();

  const arrow = delta > 0 ? "📈" : "📉";
  const sign = delta > 0 ? `+${delta}` : `${delta}`;

  return postSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${arrow} *Score AdilStar* : ${accountLink(compte)}\n${from ?? "—"} → *${to}* (${sign} pts)`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Secteur : ${compte.secteur ?? "—"} · Stage : ${compte.stage ?? "—"} · Cron refresh`,
          },
        ],
      },
    ],
  });
}

/** Alerte quand un compte passe en stage Hot ou Active. */
export function alertStageHot(
  compte: AlertCompte,
  stage: string
): Promise<void> {
  if (stage !== "Hot" && stage !== "Active") return Promise.resolve();

  const emoji = stage === "Hot" ? "🔥" : "⚡";

  return postSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *Compte ${stage}* : ${accountLink(compte)}\nPassage en stage *${stage}* détecté.`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Secteur : ${compte.secteur ?? "—"} · Priorité : ${compte.priorite ?? "—"} · Score : ${compte.scoreAdilStar ?? "—"}`,
          },
        ],
      },
    ],
  });
}

/** Alerte sur un signal critique (score 4 ou 5). */
export function alertCriticalSignal(
  compte: AlertCompte,
  title: string,
  score: string | null,
  url: string | null
): Promise<void> {
  const n = score ? parseInt(score, 10) : 0;
  if (n < 4) return Promise.resolve();

  const emoji = n >= 5 ? "🚨" : "⚠️";
  const titleText = url ? `<${url}|${title}>` : `*${title}*`;

  return postSlack({
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *Signal critique* — ${accountLink(compte)}\n${titleText}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Score opportunité : ${score ?? "—"} · Secteur : ${compte.secteur ?? "—"}`,
          },
        ],
      },
    ],
  });
}
