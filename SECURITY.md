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

## Suivi recommandé (non bloquant)

1. **CSP en mode enforcing** : après validation visuelle, passer
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy` dans `next.config.js`.
2. **Rate-limiting robuste** : remplacer le limiteur en mémoire par Upstash Ratelimit (Redis)
   ou les règles Netlify Edge (l'état mémoire n'est pas partagé entre instances serverless).
3. **Migration Next.js 15** : plusieurs avis de sécurité `next@14.2.x` ne sont corrigés qu'en
   15.x (migration à tester séparément). En attendant, l'app est derrière authentification.
4. **Remplacer `xlsx`** (vulnérabilités sans correctif) par `exceljs` pour le parsing AO.
   Surface réduite : l'upload est désormais authentifié.
5. **Zod** : étendre la validation runtime aux autres routes POST/PATCH d'écriture.
6. **DPA** : documenter les accords de traitement des données avec Anthropic, Apollo, Hunter, Explorium.
