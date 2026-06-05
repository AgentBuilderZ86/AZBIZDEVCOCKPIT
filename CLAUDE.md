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

## Stack technique de référence

| Couche | Technologie |
|--------|------------|
| Framework | Next.js 14 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| Base de données | PostgreSQL + pgvector |
| IA | Anthropic SDK (`claude-opus-4-8` enrichissement, `claude-sonnet-4-6` NBA) |
| Source de vérité | Notion SDK (`@notionhq/client`) |
| Sources externes | Apollo.io, Hunter.io, Explorium |
| PDF | `@react-pdf/renderer` |
| Déploiement | Netlify (Next.js Runtime v5, Scheduled Functions) |

---

## Erreurs connues et résolues

| Date | Fichier | Erreur | Solution |
|------|---------|--------|----------|
| 2026-06-05 | `copilot-panel.tsx:74` | `Type 'unknown' is not assignable to type 'string'` sur `data.answer` | `String(data.answer ?? "")` |
| 2026-06-05 | `journal-panel.tsx:48` | `Property 'map' does not exist on type '{}'` sur `data.events` | `(data.events as (JournalEvent & { eventDate?: string })[]) ?? []` |
| 2026-06-05 | `veille-panel.tsx:30` | `toast.info` reçoit `unknown` au lieu de `string` | `typeof data.message === "string" ? data.message : "Fallback"` |
