# Brief de génération — Présentation commerciale « BizDev OS »

> **À l'attention de l'agent Claude Code (environnement Sia / PowerPoint).**
> Ce fichier contient TOUT le nécessaire pour produire une **présentation commerciale**
> du produit décrit ci-dessous, au **branding Sia Partners**. Lis-le entièrement, puis
> génère le deck. Ne réinvente pas les faits : utilise uniquement ce qui est ici.

---

## 0) Ta mission (agent)
1. Produire un deck **PowerPoint** (.pptx) commercial, **en français**, ~14–16 slides.
2. **Branding Sia Partners** : utilise le **template/master Sia officiel présent dans cet
   environnement** (.potx/.pptx) — couleurs, logo, polices, pied de page « Sia Partners — Confidentiel ».
   Si tu utilises `python-pptx`, pars du template Sia comme base ; sinon respecte la charte Sia.
3. **Une idée par slide**, visuel fort, peu de texte (règle 6×6). Le détail va en **notes orateur**.
4. Insère des **placeholders d'images** là où des captures d'écran du produit doivent être
   collées (liste fournie en §8) — l'utilisateur les ajoutera, ou demande-les-lui.
5. Ton : **confiant mais honnête** (cf. §9 « à ne pas survendre »).

---

## 1) Le produit en une phrase
**BizDev OS** — le cockpit de développement commercial **augmenté par l'IA** pour le
conseil : il transforme un portefeuille de comptes en **machine à prioriser, enrichir et
agir**, à partir d'une source de vérité unique (Notion), sans double saisie.

**Pitch ascenseur (30 s) :**
> « En BizDev conseil, on perd un temps fou à consolider l'info, prioriser les bons comptes
> et préparer les approches. BizDev OS centralise tout le portefeuille, **score chaque compte
> et apprend de mes Won/Lost**, fait la **veille automatiquement**, et me laisse **interroger
> tout mon portefeuille en langage naturel**. Je passe de la donnée dispersée à l'action ciblée. »

**Nom & positionnement :** produit interne créé par un **Senior Manager TEC chez Sia Partners
Maroc** pour structurer l'approche commerciale du conseil (offres : transformation digitale,
data/IA, excellence opérationnelle, risque & conformité, ESG).

---

## 2) Audience cible du deck
Adaptable — précise au besoin avec l'utilisateur. Par défaut : **management Sia / pairs
Partners** (présentation interne d'un outil différenciant), avec une variante possible
« vitrine client / prospect ».

## 3) Le problème (slide « pain »)
- Information **dispersée** (Notion, mails, HubSpot, têtes) → pas de vue unifiée.
- **Priorisation au doigt mouillé** : quels comptes relancer ? lesquels sont chauds ?
- **Veille manuelle** et chronophage, vite obsolète.
- **Préparation d'approche** longue : refaire le contexte à chaque fois.
- Pas de **mémoire** : on ne capitalise pas sur les Won/Lost ni sur les références Sia.

## 4) La solution (slide « value »)
Un **OS BizDev** unifié : **centraliser → prioriser → enrichir → agir → apprendre**, avec
l'IA à chaque étape, branché sur la source de vérité de l'équipe (Notion).

---

## 5) Fonctionnalités phares (matière pour les slides « features »)

| # | Fonction | Bénéfice commercial | Visuel |
|---|----------|---------------------|--------|
| F1 | **Cockpit commercial** (action-first) | « J'ouvre, je sais quoi faire » : KPIs, À faire aujourd'hui, Portefeuille, Pilotage | capture cockpit |
| F2 | **Score AdilStar (0–100) qui apprend** | Priorisation objective ; le score **s'améliore** via régression logistique sur les Won/Lost | breakdown score |
| F3 | **Portfolio Galaxy** ⭐ | Dataviz spatiale signature : chaque compte = une étoile (taille = ARR, lueur = stage, position = score), constellations par secteur, **mode radar** des comptes à relancer | capture galaxie |
| F4 | **Copilote ⌘K (Demande tout)** | Interroge **tout le portefeuille** en langage naturel : « quels comptes banque relancer ? », « prépare un angle pour OCP » | capture ⌘K |
| F5 | **Live Intelligence Feed** | Veille web **automatique** (IA + recherche) + **tendances sectorielles** (3+ comptes qui bougent) | capture /veille |
| F6 | **Drop Zone (capture éclair)** | Dépose un texte libre → l'IA crée **contact / opportunité / tâche / note** (multi-objets, lien hiérarchique N+1) | capture Drop Zone |
| F7 | **Enrichissement IA** | Firmographie + décideurs (Apollo/Hunter/Explorium) + **plan stratégique** généré par Claude | capture enrich |
| F8 | **Offre Mapping & Synthèse** | Mappe les besoins → offres Sia (couverture RAG / expertise / **gap**) ; **topics chauds par familles** | capture bulles |
| F9 | **Base de connaissance (RAG)** | Recherche sémantique sur propales/références Sia → réponses **sourcées** | — |
| F10 | **Automatisations** | Refresh des scores + veille **planifiés** (quotidien), alertes Slack | — |

---

## 6) Différenciateurs (slide « why us / wow »)
1. **Source de vérité Notion** → zéro double saisie, adoption immédiate.
2. **IA de bout en bout** : capture, copilote, veille, scoring, enrichissement — pas un gadget IA isolé.
3. **Dataviz signature (Galaxy)** : un objet de démo mémorable, propre au produit.
4. **Apprentissage continu** : le scoring se calibre sur **tes** résultats (Won/Lost).
5. **Pensé par et pour le BizDev conseil** (offres Sia, secteurs marocains, persona terrain).

## 7) Architecture & sécurité (slide « rassurance », rester léger)
- **Stack** : Next.js 15 / React 19, **Notion** (source de vérité), **PostgreSQL + pgvector**
  (intelligence & RAG), **Claude (Anthropic)** pour l'IA, déploiement **Netlify**.
- **Sécurité** : authentification (Clerk), accès restreint, en-têtes de sécurité, rate-limiting,
  gestion des secrets, registre documenté des flux de données (DPA).
- **Honnêteté** : outil **interne / pilote** aujourd'hui (mono-utilisateur) ; les fonctions IA
  nécessitent un budget d'API. (Voir §9.)

---

## 8) Plan slide par slide (à produire)

> Format de chaque slide ci-dessous : **Titre** — puces (≤6) — *Visuel* — `Notes orateur`.

1. **Couverture** — « BizDev OS — Le cockpit BizDev augmenté par l'IA » + sous-titre + logo Sia + auteur/date. *Visuel : fond Aurora sombre / capture galaxie.* `Accroche : transformer la donnée dispersée en action commerciale ciblée.`
2. **Le constat** — 4 douleurs (§3). *Icônes.* `Poser le problème vécu en BizDev conseil.`
3. **La promesse** — Centraliser → Prioriser → Enrichir → Agir → Apprendre. *Schéma en 5 étapes.* `La boucle de valeur.`
4. **Vue d'ensemble produit** — capture du **Cockpit**. *Capture F1.* `« J'ouvre, je sais quoi faire. »`
5. **Prioriser objectivement** — Score AdilStar qui apprend (F2). *Breakdown du score.* `Insister sur l'apprentissage Won/Lost.`
6. **L'effet signature — Portfolio Galaxy** (F3). *Grande capture galaxie + radar.* `Slide « wow » : démo vivante en réunion.`
7. **Le copilote ⌘K** (F4). *Capture de la palette + réponse.* `Montrer une vraie question/réponse.`
8. **La veille qui travaille pour vous** (F5). *Capture /veille + tendance sectorielle.* `Automatisation + tendances.`
9. **Capture éclair (Drop Zone)** (F6). *Capture + exemple multi-objets.* `Zéro friction de saisie.`
10. **Enrichissement & plan stratégique IA** (F7). *Capture enrich.* `Du nom de compte au plan d'approche.`
11. **Du besoin à l'offre Sia** (F8). *Capture bulles topics + couverture.* `Mapping besoins → offres, repérage des gaps.`
12. **Sous le capot** — architecture & sécurité (F/§7). *Schéma simple.* `Rassurer sans jargon.`
13. **Différenciateurs** (§6). *5 points.* `Pourquoi c'est unique.`
14. **Bénéfices chiffrés / impact attendu** — gains de temps, meilleure priorisation, capitalisation. *Pictos.* `Rester honnête : impact attendu, à mesurer en pilote.`
15. **Vision & roadmap** (§10). *Timeline.* `Là où ça va.`
16. **Appel à l'action** — proposer un **pilote interne** / prochaine étape. *CTA.* `Conclure sur l'engagement.`

*(Slides optionnelles : démo live, FAQ sécurité/conformité, scénarios d'usage.)*

---

## 9) À NE PAS survendre (garde-fous d'honnêteté)
- C'est un **outil interne / pilote**, pas (encore) un SaaS multi-clients.
- Les **bénéfices chiffrés** sont **attendus** et à **valider en pilote** — ne pas inventer de ROI précis.
- Les fonctions IA dépendent d'un **budget d'API** (Anthropic, Apollo…).
- Pour un usage corporate large : SSO entreprise, conformité et gouvernance des données restent à finaliser.
- Formuler les forces au présent, les évolutions au futur (roadmap).

## 10) Vision & roadmap (slide dédiée)
- **Court terme** : pilote interne Sia (1 équipe TEC), durcissement SSO + conformité.
- **Évolutions produit** : *Galaxy Through Time* (rejouer l'évolution du portefeuille),
  *Morning Brief* (briefing IA quotidien), digests email des tendances.
- **Horizon** : potentiel de produit interne Sia diffusable ; SaaS multi-clients = V2 (multi-tenancy).

---

## 11) Éléments de marque & captures à fournir
- **Captures à insérer** (l'utilisateur les fournira depuis l'app) : Cockpit, Galaxy (+ radar),
  Copilote ⌘K, Live Intelligence Feed, Drop Zone, Synthèse offres (bulles), Enrichissement.
- **Identité visuelle de l'app** : thème « Aurora » sombre, dégradés indigo→violet→cyan,
  glassmorphism — peut inspirer les visuels, **mais le branding du deck reste Sia Partners**.
- **Mentions** : « Sia Partners — Confidentiel » en pied de page.

## 12) Données de référence (à citer avec prudence)
- Score AdilStar : **0–100** (stage, priorité, effectif, ARR pondéré, signaux), recalculé quotidiennement, calibré par régression logistique dès assez de Won/Lost.
- Offres Sia couvertes : transformation digitale, data/IA, excellence opérationnelle, risque & conformité, ESG, stratégie.
- Secteurs : banque, mines/engrais, BTP, agro/FMCG, port/logistique, télécom, public, énergie (contexte Maroc).

---

### Instructions finales pour l'agent
- Demande à l'utilisateur : (a) l'**audience** exacte (interne mgmt vs prospect), (b) le **template Sia**
  à utiliser, (c) les **captures d'écran**.
- Génère le .pptx, **une idée par slide**, notes orateur remplies, pied de page Sia.
- Reste **factuel** : ce brief est la seule source autorisée ; ne fabrique pas de chiffres.
