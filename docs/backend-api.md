# Contrat backend Terrova

## `POST /api/generations`

Le corps reprend le contrat validé par `src/lib/validations/generation.ts`. Les clés d’image doivent respecter `temp/{sessionId}/input/{uuid}.{jpg|png|webp}` et appartenir au `sessionId` envoyé.

Le bien contient son `type`, sa `transaction` (`Vente` ou `Location`), un `district` et des `comments` facultatifs. Les photos sont analysées directement par la pipeline IA ; les commentaires sont ajoutés au contexte du prompt. Le champ `video.prompt` contient le prompt final validé par l’utilisateur ; lorsqu’il est fourni, il est envoyé tel quel au provider vidéo. Les réglages vidéo acceptent les styles `elegant`, `dynamic`, `cinematic` et `minimal`, les formats `9:16`, `16:9` et `1:1`, ainsi que les durées 5, 10 ou 15 secondes. Un modèle peut transmettre ses consignes dans `video.templateInstructions`.

Les routes d'upload, de planification et d'estimation acceptent une session invitée. La route de génération réelle exige une session Supabase lorsque Supabase est configuré ; le client transmet alors `guestSessionId` pour vérifier les clés d'images uploadées avant de rattacher le job au compte authentifié.

## `POST /api/generation-plan`

Cette route analyse les photos autorisées avec Gemini ou Claude lorsqu’un fournisseur IA et R2 sont configurés. Le premier passage construit un scénario de visite structuré ; le second le contrôle et corrige les incohérences. Elle renvoie le prompt vidéo final et le plan de scènes. En mode démo ou si l’analyse n’est pas disponible, elle renvoie une proposition déterministe fidèle aux informations disponibles.

Réponse `202` :

```json
{
  "jobId": "openrouter-... ou demo-...",
  "status": "pending",
  "provider": "openrouter"
}
```

La création est idempotente pour une même demande et une même session. Un doublon retourne le job existant sans relancer le fournisseur.

## `GET /api/generations/:jobId`

Réponse :

```json
{
  "jobId": "openrouter_ou_demo",
  "status": "completed",
  "provider": "openrouter",
  "videoUrl": "https://..."
}
```

`videoUrl` est uniquement présent lorsque le job est terminé. L’URL de lecture est courte et doit être régénérée à chaque consultation. Le `jobId` aléatoire sert de capability URL dans le MVP, en attendant l’authentification utilisateur.

## Suivi OpenRouter

OpenRouter renvoie un identifiant et une `polling_url` après la création asynchrone. Le Workflow Terrova interroge cette URL jusqu’à un état terminal, puis récupère la première URL de `unsigned_urls` et la copie dans R2. La clé `OPENROUTER_API_KEY` reste strictement côté serveur.

## États publics

`pending`, `analyzing`, `generating`, `processing`, `completed`, `failed`.
