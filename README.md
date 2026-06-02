# Cockpit Comptes — ★ Adil BizDev OS

Application web (Next.js 14 / App Router + TypeScript + Tailwind + shadcn/ui) qui pilote le
portefeuille de comptes BizDev d'Adil Zriouil, avec **Notion comme source de vérité**
(lecture + écriture via l'API officielle `@notionhq/client`).

> État actuel : **Phases 0 → 3** livrées (scaffold, plan de comptes éditable, vue 360,
> enrichissement Apollo + Claude). Phases 4-5 (scoring continu via cron, PDF) à venir.

## Fonctionnalités

### Phase 0 & 1 — Plan de comptes
- **Accueil `/`** — KPIs portefeuille + liste des comptes lus depuis Notion (preuve de lecture).
- **Plan de comptes `/comptes`** :
  - Tableau : Compte, Secteur, Priorité, Stage, Statut relation, Score AdilStar, ARR pondéré.
  - **Édition inline** de chaque champ → write-back Notion immédiat (UI optimiste + toast,
    rollback automatique en cas d'erreur).
  - Tri par colonne + filtres (Secteur / Priorité / Stage / Statut).
  - Éditeur du champ long **Plan stratégique compte**.
  - **Création** d'un compte / **archivage** (Statut → `Dormante`).
  - **Vue board** optionnelle groupée par Secteur.

### Phase 2 — Vue 360 par compte (`/compte/[id]`)
- Entête (firmographie, Score AdilStar, Stage, Statut) + KPIs.
- Onglets **Contacts / Opportunités / Signaux** agrégés via les relations Notion.
- Bloc **Plan stratégique éditable** + Notes.
- Encart **Next Best Action** (heuristique).

### Phase 3 — Enrichissement « Populer »
- Bouton **Enrichir** sur la fiche compte → orchestration serveur :
  1. **Apollo.io** (REST) → firmographie (effectif, CA) + décideurs clés.
  2. **Claude** (`claude-opus-4-8`, adaptive thinking + structured outputs) → Score AdilStar,
     plan stratégique v1, signaux suggérés.
  3. Déduplication des contacts (email / LinkedIn / nom).
- **Diff à valider** : l'utilisateur coche les champs / contacts / signaux à écrire ; rien
  n'est appliqué en silence. Write-back via `PUT /api/comptes/[id]/enrich`.
- Dégradation propre : si Apollo ou Claude échoue (réseau, crédits), un avertissement est
  affiché et le reste de la proposition reste applicable.

## Architecture

```
app/
  page.tsx              # Accueil (lecture Notion, KPIs)
  comptes/page.tsx      # Plan de comptes (server → client)
  api/comptes/route.ts        # GET liste / POST création
  api/comptes/[id]/route.ts   # GET / PATCH (update + archive)
lib/
  config.ts             # Lecture des env vars (serveur)
  types.ts              # Types domaine + enums alignés sur Notion
  notion.ts             # Wrapper SDK Notion (server-only) + mapping
  audit.ts              # Log d'audit des write-backs
  compte-ui.ts          # Métadonnées select, couleurs badges, tri (client)
components/
  comptes/*             # Table, board, édition inline, dialogs
  ui/*                  # shadcn/ui
```

- Le SDK Notion est **server-only** (`import "server-only"` dans `lib/notion.ts`) — aucune clé
  exposée au client.
- Champs read-only (`Account ID` auto-increment, formules) lus mais jamais écrits.

## Configuration

Copier `.env.example` → `.env.local` et renseigner les secrets :

```bash
cp .env.example .env.local
```

| Variable | Rôle |
|----------|------|
| `NOTION_TOKEN` | Token de l'intégration Notion (interne) |
| `NOTION_DB_COMPTES` … | IDs des 7 bases Notion |
| `APOLLO_API_KEY`, `EXPLORIUM_API_KEY`, `ANTHROPIC_API_KEY` | Réservés aux phases d'enrichissement |

> ⚠️ **Partage Notion requis** : l'intégration liée à `NOTION_TOKEN` doit être ajoutée comme
> connexion sur la page **★ Adil BizDev OS** (ou directement sur chaque base) dans Notion,
> sinon l'API renvoie `403 restricted_resource`.

## Développement

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
```

> **Note environnement d'exécution distant** : dans le sandbox Claude Code on the web, la
> politique réseau peut ne pas autoriser `api.notion.com` (« Host not in allowlist »). Les pages
> s'affichent alors avec un message d'erreur propre. Les appels Notion fonctionnent en local
> (réseau ouvert) et sur **Vercel**. Pour tester depuis le sandbox, ajouter `api.notion.com` à
> l'allowlist réseau de l'environnement.

## Déploiement (Vercel)

1. Importer le repo sur Vercel.
2. Renseigner toutes les variables d'environnement (cf. `.env.example`).
3. Deploy — les routes API Next.js servent de backend, aucun serveur séparé.
