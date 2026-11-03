# Prompt de construction du backend Terrova

Copie-colle le prompt ci-dessous dans l’agent qui va implémenter le backend.

```text
Tu es l’ingénieur backend principal de Terrova. Travaille directement dans le dépôt existant et commence par lire README.md, AGENTS.md, .agent/state.md, .agent/skills/agentic-dev-loop/SKILL.md, les routes API existantes, les validations, le provider vidéo actuel, la configuration Cloudflare et le statut Git.

Terrova est un SaaS français de création de courtes vidéos immobilières. L’utilisateur téléverse des photos d’un bien, renseigne quelques informations confirmées et des commentaires facultatifs, choisit un style, un ratio et une durée, puis obtient une vidéo prête pour les réseaux sociaux. L’analyse visuelle des photos construit le scénario et le prompt final. Le front existe déjà. Le but est de remplacer le parcours Make.com par un backend natif, maintenable et asynchrone.

## Règles de travail

1. Respecte la boucle agentique du dépôt : NO PLAN → NO CODE, puis NO TEST + NO REVIEW → NO SHIP.
2. Commence par produire un plan court avec stories, dépendances, contrats, migrations, tests et rollback. Arrête-toi au gate de plan et attends la validation explicite avant de modifier le code de production.
3. Conserve les modifications déjà présentes dans le dépôt. Ne fais aucun reset destructif et ne réécris pas les changements utilisateur.
4. Ne lis, ne copie et ne journalise aucun secret présent dans un fichier local. Les secrets doivent uniquement être configurés comme variables secrètes Cloudflare ou variables d’environnement locales non commitées.
5. Tous les textes français générés dans le code et la documentation doivent conserver leurs accents.
6. N’invente aucun endpoint OpenRouter, modèle, champ de payload ou statut : consulte la documentation officielle et/ou le SDK officiel actuel au moment de l’implémentation, puis encapsule le contrat vérifié derrière un adaptateur.

## Architecture cible

Garde le projet comme un monolithe modulaire TypeScript exécuté sur Cloudflare Workers via l’intégration vinext existante.

- Cloudflare Workers/vinext : runtime HTTP et routes API.
- Cloudflare R2 : stockage temporaire des photos d’entrée et des vidéos de sortie. Le navigateur envoie les photos directement avec les URL présignées déjà prévues.
- Cloudflare D1 : métadonnées uniquement : jobs, étapes, états, identifiants fournisseurs, clés d’objets R2, erreurs non sensibles, idempotence et horodatages. Ne stocke jamais de binaire, de secret, de prompt complet ou d’URL présignée durable.
- Cloudflare Workflows : orchestration durable de la génération, étapes réessayables, attente de plusieurs minutes et reprise après erreur. Utilise Cloudflare Queues uniquement si l’analyse montre un besoin réel de file de messages ou de fan-out ; ne complexifie pas l’architecture sans justification.
- Gemini côté serveur : analyse structurée des informations du bien et production d’un plan de scènes en JSON strictement validé. Claude doit être disponible comme fournisseur secondaire ou fallback configurable. Les fournisseurs doivent rester invisibles dans l’interface Terrova.
- OpenRouter côté serveur : génération de la vidéo selon le contrat API officiellement disponible pour le compte. Le modèle par défaut est `bytedance/seedance-2.0-mini`. Isole l’intégration dans `src/lib/video/` ou une structure équivalente.

Ne fais aucun appel Gemini, Claude ou OpenRouter depuis le navigateur. N’utilise pas Make.com dans le nouveau chemin par défaut. Garde éventuellement un provider de compatibilité désactivable uniquement si cela réduit le risque de migration et si son statut est documenté.

## Boucle métier à implémenter

```text
POST /api/generations
  → valider la demande et vérifier les clés d’images temp/{sessionId}/input/
  → créer un job D1 idempotent en état pending
  → démarrer une instance Cloudflare Workflow
  → répondre immédiatement 202 avec jobId et status

Workflow durable
  → analyser les informations du bien avec Gemini
  → utiliser Claude comme fallback configuré si Gemini échoue
  → produire et valider un GenerationPlan JSON
  → envoyer les références `input_references` à OpenRouter depuis les URL R2 temporaires
  → attendre le statut via `polling_url` avec backoff borné
  → récupérer le résultat et le déposer dans temp/{sessionId}/output/
  → valider la présence, le type et la taille raisonnable du résultat
  → écrire completed et la clé R2 dans D1
  → supprimer les entrées temporaires quand le flux le permet ; le lifecycle R2 reste le filet de sécurité

GET /api/generations/:jobId
  → lire D1
  → vérifier l’accès au job
  → retourner le statut et, uniquement si completed, une URL R2 de lecture courte

Le suivi OpenRouter est réalisé par polling côté Workflow ; aucun webhook provider n’est requis dans le chemin par défaut.
```

## États et contrat

Conserve les états compatibles avec le front : `pending`, `analyzing`, `generating`, `processing`, `completed`, `failed`. Ajoute des états internes seulement si nécessaire et mappe-les vers ce contrat public.

Crée un modèle strict et versionné proche de :

```ts
type GenerationPlan = {
  version: 1;
  language: "fr";
  title: string;
  hook: string;
  scenes: Array<{
    index: number;
    imageKey: string;
    durationSeconds: number;
    visualPrompt: string;
    caption: string;
    voiceover?: string;
  }>;
  finalCallToAction: string;
};
```

Le schéma doit être validé avec Zod avant tout appel OpenRouter. Refuse les champs inconnus ou dangereux, limite la taille du texte et ne laisse jamais le modèle choisir une URL arbitraire : les images doivent provenir des clés R2 validées du job.

## Organisation de code attendue

Adapte la structure existante sans déplacer inutilement le front :

- `src/lib/ai/` : clients Gemini et Claude, prompt versionné, schéma `GenerationPlan`, validation et erreurs non sensibles ;
- `src/lib/video/` : interface fournisseur, adaptateur OpenRouter, mapping des statuts et erreurs ;
- `src/lib/generations/` : domaine du job, transitions autorisées, repository D1 et idempotence ;
- `src/lib/workflows/` ou `worker/` : définition du Workflow Cloudflare et points d’entrée nécessaires ;
- `db/schema.ts` et migrations Drizzle/D1 : tables et index minimaux ;
- `app/api/` : routes HTTP minces, validation et autorisation, sans logique fournisseur ;
- `docs/` : contrat API, variables, déploiement Cloudflare, cycle de vie R2 et rollback.

## Sécurité, confidentialité et fiabilité

- N’expose aucune clé Gemini, Claude, OpenRouter, R2 ou secret de callback au client.
- Ne mets jamais de secret, prompt complet, sortie IA complète, URL signée ou contenu d’image dans les logs.
- Vérifie que chaque clé d’image appartient au `sessionId` du job et respecte la regex temporaire existante.
- Utilise des URL R2 de lecture avec une expiration courte et régénère-les à la demande.
- Ajoute une limite de taille de requête, une limite d’images, une limite de scènes, une limite de tentatives et une limite de durée d’attente.
- Les retries concernent les timeouts, erreurs réseau, 429 et 5xx selon une politique bornée. Ne réessaie pas aveuglément les erreurs de validation ou d’authentification.
- Les callbacks et transitions doivent être idempotents : un doublon ne relance pas une génération et ne remplace pas un résultat terminé.
- Les échecs sont persistés avec un code technique sûr et un message utilisateur en français.
- Prévois le nettoyage des objets R2 d’entrée et de sortie, avec le lifecycle R2 comme filet de sécurité après 24 heures.

## Variables et Cloudflare

Ajoute uniquement les variables nécessaires dans `.env.example` et documente leur équivalent secret/configuration Cloudflare. Utilise des noms explicites, par exemple :

```env
GOOGLE_API_KEY=
GOOGLE_GENAI_USE_ENTERPRISE=True
GOOGLE_CLOUD_PROJECT=
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-2.5-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com
GEMINI_ENTERPRISE_BASE_URL=https://aiplatform.googleapis.com
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-20250514
ANTHROPIC_BASE_URL=https://api.anthropic.com
AI_PRIMARY_PROVIDER=gemini
AI_ALLOW_FALLBACK=true
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_VIDEO_MODEL=bytedance/seedance-2.0-mini
OPENROUTER_VIDEO_RESOLUTION=720p
OPENROUTER_HTTP_REFERER=
OPENROUTER_APP_TITLE=Terrova
GENERATION_MAX_ATTEMPTS=3
GENERATION_POLL_INTERVAL_SECONDS=10
```

Adapte la configuration Worker avec les bindings D1, R2 et Workflow réellement supportés par la version installée de Wrangler/vinext. Vérifie les types Cloudflare et le fonctionnement local avant de proposer une configuration de production. Ne remplace pas une binding existante sans vérifier son nom.

## Tests obligatoires

Ajoute et exécute des tests pour :

- validation d’une demande correcte et rejet des clés R2 étrangères ou invalides ;
- transitions d’état autorisées et refus des transitions incohérentes ;
- idempotence de la création d’un job et des callbacks ;
- validation du `GenerationPlan` Gemini/Claude, JSON invalide et sortie incomplète ;
- mapping OpenRouter succès, attente, erreur fournisseur, 429, timeout et résultat sans URL ;
- absence de secrets, prompts et URL signées dans les logs ;
- isolation des jobs et contrôle d’accès ;
- génération d’une URL de lecture uniquement pour un job terminé ;
- fonctionnement en mode démo/local sans secrets réels ;
- build, lint et typecheck du projet existant.

Si un test d’intégration Cloudflare exige un service indisponible localement, explique précisément le blocage et fournis un test de contrat déterministe en complément. Ne déclare pas la livraison prête sans revue indépendante du diff, du plan et des preuves de test.

## Résultat attendu

À la fin, fournis :

1. le plan et les décisions prises ;
2. le diff de code backend et les migrations ;
3. le contrat API et les variables Cloudflare ;
4. les commandes locales et de déploiement ;
5. les tests exécutés avec leur résultat ;
6. les risques restants et le rollback ;
7. la revue indépendante consignée dans `.agent/state.md`.
```

## Références à vérifier avant implémentation

- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Quickstart OpenRouter](https://openrouter.ai/docs/quickstart)
- [Génération vidéo OpenRouter](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [Références image OpenRouter](https://openrouter.ai/docs/cookbook/video-generation/reference-to-video)
