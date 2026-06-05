# Cockpit Comptes — ★ Adil BizDev OS

Application web (Next.js 14 / App Router + TypeScript + Tailwind + shadcn/ui) qui pilote le
portefeuille de comptes BizDev d'Adil Zriouil, avec **Notion comme source de vérité**
(lecture + écriture via l'API officielle `@notionhq/client`).

> État actuel : **Phases 0 → 6.2** livrées (+ Intelligence S0 : Postgres, RAG `/connaissance`,
> copilote compte, journal UI). **Phase 7** (scoring apprenant) : historique + outcomes en cours.
> Déploiement cible : **Netlify** (runtime Next.js officiel + Scheduled Functions).

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
  1. **Apollo.io** (REST) → firmographie (effectif, CA) + décideurs (plan payant requis).
  2. **Hunter.io** (Domain Search) → décideurs **avec emails** (par nom ou domaine). Optionnel
     (`HUNTER_API_KEY`), complémentaire d'Apollo.
  3. **Claude** (`claude-opus-4-8`, adaptive thinking + structured outputs) → Score AdilStar,
     plan stratégique v1, signaux suggérés.
  4. Déduplication des contacts (email / LinkedIn / nom) entre toutes les sources.
- **Diff à valider** : l'utilisateur coche les champs / contacts / signaux à écrire ; rien
  n'est appliqué en silence. Write-back via `PUT /api/comptes/[id]/enrich`.
- Dégradation propre : si Apollo ou Claude échoue (réseau, crédits), un avertissement est
  affiché et le reste de la proposition reste applicable.

### Phase 4 — Scoring continu (Netlify Scheduled Function)
- `lib/scoring.ts` : Score AdilStar **heuristique** (déterministe, sans appel externe →
  fiable et gratuit sur cron) à partir de Stage, Priorité, Effectif, ARR, Statut.
- `app/api/cron/refresh` : recalcule les scores des comptes non dormants, write-back Notion
  si changement. **Protégé par `CRON_SECRET`** (Bearer ou `?key=`).
- `netlify/functions/scheduled-refresh.mts` : Scheduled Function Netlify (cron `0 6 * * *`)
  qui déclenche la route avec le secret.

### Phase 5 — Rapports & Focus compte (PDF)
- **Focus compte** (`/api/compte/[id]/pdf`) : one-pager — entête, KPIs, Next Best Action,
  plan stratégique, contacts clés, signaux. Bouton « Focus PDF » sur la fiche 360.
- **Rapport portefeuille** (`/api/rapport/pdf`) : KPIs globaux, répartition secteur/stage,
  top comptes par score, dormants/à risque. Bouton sur l'accueil.
- Génération via `@react-pdf/renderer` (serveur), charte Sia/AZ (`lib/pdf/`).

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
| `APOLLO_API_KEY`, `HUNTER_API_KEY`, `EXPLORIUM_API_KEY`, `ANTHROPIC_API_KEY` | Enrichissement (Apollo, Hunter, Claude) |

> ⚠️ **Partage Notion requis** : l'intégration liée à `NOTION_TOKEN` doit être ajoutée comme
> connexion sur la page **★ Adil BizDev OS** (ou directement sur chaque base) dans Notion,
> sinon l'API renvoie `403 restricted_resource`.

## Extension Intelligence (Sprint S0)

Couche **optionnelle** Postgres (`pgvector`) pour journal, jobs async et futur RAG.
Sans `DATABASE_URL`, l'app reste en mode Notion seul (Phases 0–5).

1. Créer un projet [Supabase](https://supabase.com) ou [Neon](https://neon.tech) et activer l'extension `vector`.
2. Copier la connection string dans `DATABASE_URL` (`.env.local` + Netlify).
3. Placer `DATABASE_URL` dans **`.env.local`** à la racine (le script charge ce fichier automatiquement).

4. Diagnostic puis migration :

```bash
npm run db:check    # teste la connexion + extension vector
npm run db:migrate  # applique migrations/001, 002…
```

5. Vérifier : `GET /api/intelligence/health` → `{ "enabled": true, "ok": true }`.

**Secrets agent cloud (Supabase)**

1. [cursor.com → Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) : `DATABASE_URL` (type **Environment Variable** ou **Runtime Secret**, pas Build Secret).
2. **Relancer un nouvel agent** après avoir ajouté le secret (injection au boot).
3. Dans l'agent : `npm run db:check` puis `npm run db:migrate:cloud` (n'utilise pas le Postgres local).

**Option A — Postgres local (sans Supabase)**

```bash
npm run db:provision-local   # installe Postgres+pgvector, .env.local.dev, migrate
# ou : cp env/.env.local.dev.example .env.local.dev && USE_LOCAL_DB=1 npm run db:migrate
# ou : docker compose up -d && USE_LOCAL_DB=1 npm run db:migrate
```

**Option B — Supabase sans CLI**

1. Activer l’extension **vector** dans le dashboard.
2. Exporter le SQL : `npm run db:export-sql > supabase-manual.sql`
3. Coller dans **SQL Editor** → Run.

**Supabase — pièges fréquents**

| Problème | Solution |
|----------|----------|
| `DATABASE_URL manquante` | Fichier `.env.local` à la racine, pas seulement Netlify |
| `password authentication failed` | Settings → Database → reset password ; mettre à jour l’URL |
| `extension "vector" is not available` | Database → Extensions → activer **vector** |
| Connexion timeout / SSL | Utiliser l’URI **Session** (port **5432**) pour `db:migrate` |
| Mot de passe avec `@`, `#`… | [Encoder l’URL](https://www.w3schools.com/tags/ref_urlencode.asp) (`@` → `%40`) |
| Confondre avec Notion | `DATABASE_URL` = URI **PostgreSQL** (`postgresql://…`), pas un token Notion |

**Journal de compte** (append-only) : alimenté automatiquement après enrichissement,
PATCH compte et cron score. Saisie manuelle : `POST /api/compte/[id]/journal` avec
`{ "note": "CR RDV …" }`. Lecture : `GET /api/compte/[id]/journal`.

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Postgres + pgvector |
| `EMBEDDINGS_API_KEY` | Voyage ou OpenAI (Phase 6, S1) |
| `EMBEDDINGS_MODEL` | Défaut `voyage-3` (1024 dim) |

En **production**, `CRON_SECRET` est **obligatoire** pour `/api/cron/*`.

### Phase 6 — Base de connaissance (RAG)

Page **`/connaissance`** : upload `.txt` / `.md` / `.pdf`, indexation vectorielle, recherche test avec scores de similarité.

| Variable | Rôle |
|----------|------|
| `EMBEDDINGS_API_KEY` | [Voyage AI](https://dash.voyageai.com) (`voyage-3`, 1024 dim) ou OpenAI embeddings |
| `EMBEDDINGS_MODEL` | Défaut `voyage-3` |
| `VOYAGE_EMBED_BATCH_SIZE` | Défaut `3` — taille des lots d’embedding (gros PDF) |
| `VOYAGE_EMBED_BATCH_DELAY_MS` | Défaut `0` — mettre `21000` si compte Voyage sans carte (palier 3 req/min) |

Sans moyen de paiement sur [Voyage billing](https://dashboard.voyageai.com/), les limites sont **3 RPM / 10K TPM** ; ajouter une carte débloque les quotas standard (les 200M tokens gratuits restent).

API : `GET /api/knowledge`, `POST /api/knowledge/ingest`, `POST /api/knowledge/search`.

### Phase 6.2 — Copilote fiche compte

Sur **`/compte/[id]`** : panneau « Demander au copilote » — RAG filtré par secteur du compte + contexte Notion + réponse Claude avec badges sources.

API : `POST /api/compte/[id]/copilot` body `{ "question": "…" }`.

### Phase 6.3 — Journal de compte (UI)

Sur **`/compte/[id]`** : timeline append-only (enrichissements, scores cron, saisie manuelle CR RDV).

API : `GET/POST /api/compte/[id]/journal`.

### Phase 7 — Scoring apprenant (fondations)

Tables `score_history` et `outcome_events` alimentées par le **cron** (`/api/cron/refresh`) à chaque changement de score et pour les opps **Won/Lost**. Prochaine étape : pondérations apprises à partir de l’historique.

## Développement

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
```

> **Note environnement d'exécution distant** : dans le sandbox Claude Code on the web, la
> politique réseau peut ne pas autoriser `api.notion.com` (« Host not in allowlist »). Les pages
> s'affichent alors avec un message d'erreur propre. Les appels Notion fonctionnent en local
> (réseau ouvert) et sur **Netlify**. Pour tester depuis le sandbox, ajouter `api.notion.com`
> à l'allowlist réseau de l'environnement.

## Déploiement (Netlify)

1. **Connecter le repo** à Netlify (New site from Git). `netlify.toml` configure déjà le
   build (`npm run build`) et le runtime Next.js (`@netlify/plugin-nextjs`).
2. **Variables d'environnement** : Site settings → Environment variables — renseigner
   `NOTION_TOKEN`, `NOTION_DB_*`, `APOLLO_API_KEY`, `HUNTER_API_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`
   (cf. `.env.example`). Ne pas committer `.env.local`.
3. **Deploy** — les routes API Next.js servent de backend (aucun serveur séparé).
4. **Scheduled Function** : `netlify/functions/scheduled-refresh.mts` s'enregistre
   automatiquement (cron `0 6 * * *`) et déclenche le recalcul des scores. Ajuster le
   `schedule` dans le fichier si besoin.

> ⚠️ Prérequis runtime : partager les bases Notion avec l'intégration `NOTION_TOKEN` ;
> disposer de crédits Anthropic actifs pour l'enrichissement Claude.
