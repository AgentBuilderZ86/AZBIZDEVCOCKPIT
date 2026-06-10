# Traitement des données & sous-traitants (DPA)

Registre des flux de données vers des services tiers, pour l'évaluation de conformité
(usage corporate Sia Partners). À tenir à jour si une intégration évolue.

> Coupe-circuit : `DISABLE_EXTERNAL_ENRICHMENT=1` désactive tout envoi de données
> client à Apollo / Hunter / Explorium (l'app reste fonctionnelle sur Notion + IA).

## Sous-traitants et données transmises

| Service | Rôle | Données envoyées | Données reçues | Déclencheur |
|---------|------|------------------|----------------|-------------|
| **Notion** | Source de vérité (hébergement) | Tous les comptes, contacts, opportunités, signaux | — | Lecture/écriture continue |
| **Anthropic (Claude)** | Analyse IA | Nom du compte, secteur, effectif, CA estimé, **plan stratégique**, **notes internes**, noms/titres des contacts, signaux | Texte d'analyse (score, plan, reco) | Enrichissement, copilote, analyse d'offres, Drop Zone |
| **Apollo.io** | Firmographie + décideurs | Nom + domaine de l'entreprise, intitulés de postes recherchés | Firmo société, contacts (noms/titres) | Enrichissement compte |
| **Hunter.io** | Recherche d'e-mails | Nom/domaine de l'entreprise | E-mails + identités de contacts | Enrichissement compte |
| **Explorium** | Matching société | Nom + domaine de l'entreprise | Identifiant/firmo société | Enrichissement compte |
| **Slack** (webhook, optionnel) | Notifications | Nom du compte, score, stage, signaux critiques | — | Alertes (si `SLACK_WEBHOOK_URL`) |
| **Postgres** (Neon/Supabase) | Base Intelligence | Journal, tâches, base de connaissance, embeddings | — | Si `DATABASE_URL` défini (SSL forcé) |
| **Embeddings** (Voyage/OpenAI, optionnel) | Vectorisation RAG | Extraits de documents ingérés | Vecteurs | Ingestion connaissance |
| **Clerk** | Authentification | E-mail / identité de connexion | Session | À chaque connexion |

## Points de conformité à valider

1. **DPA signés** avec chaque sous-traitant traitant des données personnelles/confidentielles :
   - Anthropic — https://www.anthropic.com/legal/commercial-terms (les données API ne sont pas utilisées pour l'entraînement ; vérifier l'option *zero data retention* si requise).
   - Apollo.io, Hunter.io, Explorium — vérifier les DPA et la localisation des données (UE/US).
   - Clerk, Neon/Supabase, Voyage/OpenAI — DPA + région d'hébergement.
2. **Minimisation** : envisager de tronquer/rédiger les notes internes avant envoi à Anthropic
   (le plan stratégique est déjà limité côté code). Réduire le contexte au strict nécessaire.
3. **Localisation** : confirmer que l'hébergement (Notion, DB, Clerk) respecte les exigences
   de résidence des données applicables aux données clients Sia Partners.
4. **Désactivation** : pour les comptes les plus sensibles, utiliser `DISABLE_EXTERNAL_ENRICHMENT=1`
   afin de ne rien transmettre aux courtiers de données (Apollo/Hunter/Explorium).
5. **Journalisation** : les logs d'audit masquent désormais les valeurs PII (cf. `lib/audit.ts`).

## Données personnelles concernées
Noms, intitulés de poste, e-mails professionnels, téléphones professionnels, profils LinkedIn
de contacts chez les comptes prospects/clients. Traitement au titre de l'intérêt légitime (BizDev B2B).
