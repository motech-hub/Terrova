# Moteur multi-agents Terrova

Le moteur complète le flux de génération existant. Il ne modifie ni les crédits, ni le paiement, ni le provider vidéo OpenRouter.

## Architecture

Terrova (Cloudflare Worker) conserve l'authentification, les autorisations, la persistance D1 et les transitions d'état. Le service `services/agent-runner` est un service Python privé utilisant l'OpenAI Agents SDK. Il n'est jamais appelé par le navigateur.

Les agents ne s'échangent pas de conversation libre. Chaque étape crée un artefact JSON validé : entrée de génération, dispatch, plan de scènes et revue. Les données persistées dans D1 excluent les images, les URL présignées, les prompts système et les secrets.

Le contrat entre Terrova et le runner emploie `snake_case`. Après validation, le Worker adapte uniquement les clés nécessaires aux contrats TypeScript existants.

Les traces du SDK sont corrélées au `trace_id` du run Terrova. Elles conservent les étapes utiles au diagnostic, mais excluent les entrées, sorties d'outils et générations potentiellement sensibles. D1 est obligatoire en production : un binding ou une migration manquante bloque l'activation au lieu de basculer silencieusement en mémoire.

## Agents du MVP

- `orchestrator` sélectionne le parcours autorisé ;
- `video_planner` crée le plan de scènes ;
- `plan_reviewer` approuve, demande des corrections ou bloque ;
- `plan_fixer` applique les findings validés.

Les définitions activées sont stockées dans `agent_definitions`. Leur clé de prompt et leur liste d'outils sont configurables, mais le runner refuse toute clé de prompt ou tout outil qui ne figure pas dans son registre applicatif.

## Boucle de revue

```text
orchestrator → video_planner → plan_reviewer
                                  ├─ approved → completed
                                  ├─ changes_required → plan_fixer → plan_reviewer
                                  └─ blocked → needs_human_review
```

La boucle accepte au plus deux corrections. Une troisième demande ou un blocage termine le run avec `needs_human_review`.

## Données et permissions

Lorsqu'il est activé, Terrova envoie au runner le contexte du bien et des URL R2 temporaires, uniquement pour le run concerné. Chaque agent reçoit un sous-ensemble d'outils en lecture seule. Aucun agent n'obtient un accès au shell, à D1, aux paiements, aux secrets, à OpenRouter ni au Web.

## Configuration

Dans Terrova :

```env
AGENTIC_VIDEO_PLANNING_ENABLED=true
AGENT_RUNNER_URL=https://agent-runner.example.internal
AGENT_RUNNER_SHARED_SECRET=<secret-long-et-unique>
```

Dans le service Python :

```env
OPENAI_API_KEY=<clé-OpenAI-serveur>
AGENT_RUNNER_SHARED_SECRET=<même-secret-long-et-unique>
```

Le runner requiert Python 3.10 ou plus récent. Il s'installe avec `pip install -e .` depuis `services/agent-runner`, puis se lance avec `uvicorn terrova_agent_runner.app:app --host 0.0.0.0 --port 8000`. Il doit être isolé du trafic public et n'accepter que les appels provenant de Terrova.
