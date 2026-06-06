/**
 * Configuration serveur — lit les variables d'environnement.
 * Ce module ne doit JAMAIS être importé depuis un composant client.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Renseignez-la dans .env.local (cf. .env.example).`
    );
  }
  return value;
}

/** Lazy : ne lève l'erreur qu'au moment d'un appel Notion, pas au build. */
export function notionConfig() {
  return {
    token: required("NOTION_TOKEN"),
    db: {
      comptes: required("NOTION_DB_COMPTES"),
      contacts: process.env.NOTION_DB_CONTACTS ?? "",
      opportunites: process.env.NOTION_DB_OPPORTUNITES ?? "",
      signaux: process.env.NOTION_DB_SIGNAUX ?? "",
      offres: process.env.NOTION_DB_OFFRES ?? "",
      objectifs: process.env.NOTION_DB_OBJECTIFS ?? "",
    },
  };
}

/** Clés réservées aux phases ultérieures (enrichissement). */
export const integrations = {
  apolloApiKey: process.env.APOLLO_API_KEY ?? "",
  hunterApiKey: process.env.HUNTER_API_KEY ?? "",
  exploriumApiKey: process.env.EXPLORIUM_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
};
