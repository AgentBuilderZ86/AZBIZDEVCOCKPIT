# AGENTS.md

Instructions pour les agents Cursor travaillant sur ce dépôt.

## Cursor Cloud specific instructions

### Produit

Application unique **Cockpit Comptes** (Next.js 14 App Router, npm). Pas de monorepo, pas de Docker, pas de base locale. La source de vérité métier est **Notion** (API distante).

### Démarrage local

Référence : `README.md`.

```bash
cp .env.example .env.local   # puis renseigner les secrets
npm install
npm run dev                  # http://localhost:3000
```

Pour un comportement proche prod : `npm run build` puis `npm start`.

### Variables d'environnement

Sans `NOTION_TOKEN` et `NOTION_DB_COMPTES`, les pages `/` et `/comptes` s'affichent mais montrent une erreur explicite (comportement attendu). Pour un flux E2E avec données réelles, configurer au minimum :

- `NOTION_TOKEN`, `NOTION_DB_COMPTES`
- Pour la vue 360 : `NOTION_DB_CONTACTS`, `NOTION_DB_OPPORTUNITES`, `NOTION_DB_SIGNAUX`
- Enrichissement : `ANTHROPIC_API_KEY` (+ optionnel `APOLLO_API_KEY`, `HUNTER_API_KEY`)
- Cron protégé : `CRON_SECRET` (sinon `/api/cron/refresh` accepte les requêtes sans auth)

L'intégration Notion doit être **partagée** sur les bases, sinon erreur `403` (voir README).

### Lint / build / tests

| Commande | Rôle |
|----------|------|
| `npm run build` | Build production + vérification TypeScript (passe sans `.env.local` grâce au chargement lazy de `notionConfig()`) |
| `npm run lint` | ESLint via `next lint` — le dépôt n'inclut pas encore de fichier `.eslintrc*` ; au premier lancement, `next lint` peut demander une configuration interactive. Préférer `npm run build` pour valider le code en CI/agent non interactif. |
| Tests automatisés | Aucune suite `test` dans `package.json` pour l'instant |

### Services à lancer

Un seul processus requis en dev : **Next.js** (`npm run dev`). Pas de worker, Redis ou Postgres local.

### Réseau

Les appels vers `api.notion.com` (et APIs d'enrichissement) nécessitent un accès réseau sortant. Certains sandboxes peuvent bloquer Notion ; Netlify ou un réseau ouvert conviennent pour les tests avec vraies données.

### Cron en local

```bash
curl -X POST http://localhost:3000/api/cron/refresh \
  -H "Authorization: Bearer $CRON_SECRET"
```

(ou `?key=` si `CRON_SECRET` est défini)
