# Sécurité — AZ BizDev OS

Ce document résume l'audit de sécurité et les mesures de durcissement appliquées,
ainsi que les actions manuelles requises pour un usage corporate (données Sia Partners).

## ⚠️ Action requise avant mise en production

L'application **se verrouille par défaut** : sans configuration Clerk, personne ne peut entrer.

1. **Créer une application Clerk** (https://dashboard.clerk.com) et définir en variables
   d'environnement Netlify :
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
2. **Restreindre l'accès** dans Clerk → *User & Authentication → Restrictions* :
   - Activer l'**allowlist** et n'autoriser que ton e-mail.
   - Désactiver l'inscription publique (sign-up).
3. (Recommandé) **Allowlist e-mail côté code** : définir `ALLOWED_EMAILS=ton@email`
   et ajouter dans Clerk un *JWT template* de session contenant
   `{"email": "{{user.primary_email_address}}"}` pour que le middleware filtre aussi.
4. Vérifier que `CRON_SECRET` est défini (protège les routes cron/serveur-à-serveur).

## Mesures appliquées dans cette livraison

| Axe | Mesure |
|-----|--------|
| **Authentification** | `middleware.ts` (Clerk) impose un login sur **toutes** les pages et routes `/api/*` (sauf `/api/cron/*`, protégées par `CRON_SECRET`). API non authentifiée → `401` ; page → redirection `/sign-in`. |
| **Autorisation** | Allowlist e-mail (`ALLOWED_EMAILS`) dans le middleware et `lib/auth.ts`. |
| **Exports PDF** | `/api/rapport/pdf` et `/api/compte/[id]/pdf` désormais derrière l'authentification. |
| **Rate-limiting** | `lib/rate-limit.ts` (best-effort, en mémoire) sur `/api/*` → `429` au-delà du seuil. |
| **En-têtes de sécurité** | `next.config.js` : HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP en *Report-Only*. `poweredByHeader` désactivé. |
| **Gouvernance données** | `DISABLE_EXTERNAL_ENRICHMENT=1` coupe tout envoi de données client à Apollo/Hunter/Explorium. |
| **Logs** | `lib/audit.ts` masque les valeurs PII (email, téléphone, notes…), ne logge que les noms de champs. |
| **Uploads** | `/api/ao/upload` valide désormais le type MIME en plus de l'extension et de la taille (5 Mo). |
| **Validation** | Schéma Zod sur `/api/drop-zone/create` (pattern à étendre aux autres routes d'écriture). |

## Constats sains (déjà conformes)

- Aucun secret committé ; `.gitignore` couvre `.env*` ; aucune clé exposée côté client (`"server-only"`).
- Pas d'injection SQL (requêtes paramétrées `postgres.js`), pas de XSS (`dangerouslySetInnerHTML` absent), pas de SSRF.
- Connexion Postgres en SSL forcé (Neon/Supabase).

## Suivi — état

| # | Item | État |
|---|------|------|
| 1 | Remplacer `xlsx` (vulnérable) par `exceljs` | ✅ Fait |
| 2 | Étendre la validation Zod / UUID aux routes d'écriture | ✅ Fait (comptes, journal, taches, revue-actions) |
| 3 | CSP en mode enforcing | ✅ Toggle `CSP_ENFORCE=1` (Report-Only par défaut ; activer après validation visuelle) |
| 4 | Rate-limiting robuste (Upstash) | ✅ Fait sur les routes coûteuses (`lib/rate-limit-upstash.ts`, runtime Node) ; définir `UPSTASH_REDIS_REST_URL/_TOKEN` pour l'activer |
| 5 | Registre DPA / flux de données tiers | ✅ Fait → `DATA-PROCESSING.md` |
| 6 | Migration Next.js 15 (CVE Next) | ⏳ PR séparée (`claude/next15-migration`) — **QA runtime requise avant merge** |

### Actions manuelles restantes
- Activer `CSP_ENFORCE=1` après vérification visuelle de l'UI.
- Définir les variables Upstash pour un quota global partagé (sinon repli mémoire par instance).
- Valider puis merger la migration Next.js 15 (React 19) après QA en preview.
- Signer/documenter les DPA listés dans `DATA-PROCESSING.md`.
