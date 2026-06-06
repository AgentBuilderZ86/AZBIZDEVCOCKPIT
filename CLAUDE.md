# CLAUDE.md — Règles & mémoire du projet AZ BizDev OS

Ce fichier est lu automatiquement par Claude Code avant chaque session.
Il contient les conventions, les erreurs connues et les règles à respecter impérativement.

---

## Règle n°1 — `parseApiJson` : toujours caster les propriétés

### Contexte
`lib/parse-api-json.ts` retourne le type `{ error?: string; [key: string]: unknown }`.
Toutes les propriétés autres que `error` ont le type `unknown`.

### Conséquences TypeScript (build Netlify échoue)
- Passer `data.xxx` à `toast.info/success/error` → **erreur** : `unknown` n'est pas assignable à `string | number | bigint | boolean`
- Utiliser `(data.xxx ?? []).map(...)` → **erreur** : `Property 'map' does not exist on type '{}'`
- Utiliser `data.xxx` comme string directement → **erreur** : `Type 'unknown' is not assignable to type 'string'`

### Solutions à appliquer systématiquement

```typescript
// ❌ FAUX — data.message est unknown
toast.info(data.message ?? "Fallback");

// ✅ CORRECT — guard typeof
toast.info(typeof data.message === "string" ? data.message : "Fallback");

// ✅ CORRECT — String() cast explicite
toast.info(String(data.message ?? "Fallback"));
```

```typescript
// ❌ FAUX — data.events est unknown, pas un array
(data.events ?? []).map((e: EventType) => ...)

// ✅ CORRECT — cast explicite vers le type attendu
(data.events as EventType[] ?? []).map((e) => ...)
// ou
((data.events as EventType[]) ?? []).map((e) => ...)
```

```typescript
// ❌ FAUX — data.answer est unknown
content: data.answer,  // dans un objet typé string

// ✅ CORRECT
content: String(data.answer ?? ""),
```

### Fichiers concernés (utilisent parseApiJson)
- `components/compte/copilot-panel.tsx`
- `components/compte/journal-panel.tsx`
- `components/compte/veille-panel.tsx`
- `components/compte/enrich-dialog.tsx`

### Règle générale
> Chaque accès à une propriété de `data` retourné par `parseApiJson` **doit** être casté
> avant usage. Ne jamais assumer que le type est inféré automatiquement.

---

## Règle n°2 — `connaissance-client.tsx` utilise `res.json()`, pas `parseApiJson`

`components/connaissance/connaissance-client.tsx` utilise `await res.json()` directement
(type `any`). Pas de problème TypeScript sur ce fichier. Ne pas le migrer vers
`parseApiJson` sans recaster toutes les propriétés.

---

## Règle n°3 — Structure des pages et espacements

### Espacements standards (compact, optimisé pour minimiser le scroll)
| Contexte | Valeur recommandée |
|---------|-------------------|
| Padding vertical page (`py-*`) | `py-4` à `py-6` max |
| Margin bottom section (`mb-*`) | `mb-3` à `mb-5` max |
| Gap entre sections (`mt-*`) | `mt-3` à `mt-4` max |
| Gap grille KPIs | `gap-2` à `gap-3` |

### À éviter
- `py-10`, `mb-10`, `mb-8` sur les containers principaux → génère trop de scroll vertical
- Section "aperçu comptes" en bas du dashboard → redondante avec `/comptes`

---

## Règle n°4 — Branches de développement

Toujours développer sur la branche feature désignée (`claude/xxx`), jamais directement
sur `main` sauf pour des hotfixes de build (TypeScript, lint).

---

## Règle n°5 — Netlify : limites et architecture async obligatoire

### Limite 26s ABSOLUE
Netlify tue toute fonction serverless à **26 secondes** sans exception.
`maxDuration` est une option Vercel uniquement — elle est **ignorée sur Netlify**.

### Règle : ne jamais mettre >20s de travail dans une route synchrone
- Toute opération IA (Claude) + sources externes (Apollo/Hunter) dépasse 26s ensemble.
- Solution obligatoire : séparer en Phase 1 synchrone (<15s) + Phase 2 async.

### Architecture approuvée pour les features longues (enrichissement, offre-analysis)

```
Route POST (~6-15s)          Background Function (∞)
─────────────────────        ──────────────────────────
1. Collecte sources          4. Claude Sonnet (~15-25s)
2. Queue job DB              5. completeJob(result)
3. Trigger bg function ──►
4. Return 202 + jobId

Client : poll /api/intelligence/jobs/[jobId] toutes les 3s
```

### Fichier background function (pattern obligatoire)
- Placer dans `netlify/functions/NOM-background.mts` (suffixe `-background` = Netlify retourne 202 immédiatement)
- La fonction appelle `/api/cron/jobs?limit=1` pour déléguer au worker Next.js existant
- Ne jamais importer `lib/` directement depuis une Netlify Function (risque de compilation)

```typescript
// netlify/functions/xxx-background.mts
export default async function handler() {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "";
  const res = await fetch(`${base}/api/cron/jobs?limit=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
  });
  return new Response(await res.text(), { status: res.status });
}
export const config: Config = { path: "/api/xxx-bg" };
```

### `triggerJobWorker` est NON FIABLE sur Netlify
`triggerJobWorker` utilise un fetch fire-and-forget. Netlify gèle la fonction dès qu'elle retourne une réponse — le fetch est annulé. **Ne jamais compter sur `triggerJobWorker` pour déclencher un job critique.** Utiliser une Background Function à la place.

### timeout_worker dans `/api/cron/jobs`
- Jobs courts (veille, knowledge.ingest) : 22s
- `enrich.intel` (Claude Sonnet) : **45s** (configuré par job type dans la route)

---

## Règle n°6 — Polling : lire `data.job.status`, pas `data.status`

La route `GET /api/intelligence/jobs/[id]` retourne `{ job: { status, result, error } }`.

```typescript
// ❌ FAUX — data.status est undefined (le job est imbriqué)
const data = await parseApiJson(res);
if (data.status === "done") { ... }        // ne fire jamais
if (data.status === "failed") { ... }      // ne fire jamais

// ✅ CORRECT — extraire data.job d'abord
const data = await parseApiJson(res);
const job = data.job as { status: string; result?: ...; error?: string } | undefined;
if (!job) continue;
if (job.status === "failed") throw new Error(String(job.error ?? "Échec."));
if (job.status === "done") { /* utiliser job.result */ }
```

Ce bug a causé les phases A de polling d'enrichissement à tourner 90s puis timeout.

---

## Règle n°7 — Modèles IA et budgets tokens

| Fonction | Modèle | max_tokens | Durée approx. |
|----------|--------|-----------|---------------|
| Enrichissement intel (`generateAccountIntelligence`) | `claude-sonnet-4-6` | 1200 | 8-15s |
| Copilot (`askAccountCopilot`) | `claude-sonnet-4-6` | 2048 | 8-15s |
| Offre mapping (`analyzeCompteOffres`) | `claude-sonnet-4-6` | 3000 | 10-20s |

- **Ne jamais utiliser `claude-opus-4-8`** pour des routes synchrones — trop lent (15-25s).
- **Ne jamais dépasser 2048 tokens** pour une réponse dans une route synchrone Netlify.
- `revealPhones` Apollo supprimé — trop lent (3-5s) et non nécessaire (emails suffisent).
- `webResearchContacts` supprimé — 8-15s, dépasse systématiquement le budget worker.

---

## Stack technique de référence

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 14 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| Base de données | PostgreSQL + pgvector (Neon/Supabase) |
| IA | Anthropic SDK (`claude-sonnet-4-6` pour tout) |
| Source de vérité | Notion SDK (`@notionhq/client`) |
| Sources externes | Apollo.io, Hunter.io, Explorium |
| PDF | `@react-pdf/renderer` |
| Déploiement | Netlify (Next.js Runtime v5, Scheduled Functions, Background Functions) |

---

## Erreurs connues et résolues

| Date | Fichier | Erreur | Solution |
|------|---------|--------|----------|
| 2026-06-05 | `copilot-panel.tsx:74` | `Type 'unknown' is not assignable to type 'string'` sur `data.answer` | `String(data.answer ?? "")` |
| 2026-06-05 | `journal-panel.tsx:48` | `Property 'map' does not exist on type '{}'` sur `data.events` | `(data.events as (JournalEvent & { eventDate?: string })[]) ?? []` |
| 2026-06-05 | `veille-panel.tsx:30` | `toast.info` reçoit `unknown` au lieu de `string` | `typeof data.message === "string" ? data.message : "Fallback"` |
| 2026-06-06 | `enrich-dialog.tsx` | Polling tourne 90s sans détecter "done" | `data.job.status` pas `data.status` (route retourne `{ job: {...} }`) |
| 2026-06-06 | `enrich/route.ts` | Timeout Netlify 26s sur enrichissement | Architecture Background Function : Phase 1 sync (<6s) + Phase 2 via `enrich-intel-background.mts` |
| 2026-06-06 | `job-runner.ts` | `triggerJobWorker` fire-and-forget tué par Netlify | Remplacé par Background Function pour les jobs critiques |
| 2026-06-06 | `enrichment.ts` | Phase 1 séquentielle 8-12s | Toutes sources en parallèle simultané → 4-6s |
