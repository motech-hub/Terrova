# Déploiement Cloudflare

## Bindings

Le build produit les bindings suivants :

- D1 : `DB`, pour les métadonnées de jobs ;
- R2 : `MEDIA`, pour les médias temporaires ;
- Workflow : `GENERATION_WORKFLOW`, classe `GenerationWorkflow`.

Les migrations sont `db/migrations/0001_generation_jobs.sql` à `db/migrations/0004_payments.sql`. Applique-les dans la base D1 cible avant de lancer des générations ou des paiements réels.

Le contrat OpenRouter vidéo est décrit dans la [documentation officielle](https://openrouter.ai/docs/guides/overview/multimodal/video-generation) : la création se fait sur `/api/v1/videos`, puis le statut est suivi sur `/api/v1/videos/{jobId}`. Les références image utilisent `input_references`.

Les secrets applicatifs doivent être ajoutés dans l’environnement Cloudflare, jamais dans Git : Gemini, Claude, `OPENROUTER_API_KEY`, `GUEST_SESSION_SECRET` et les identifiants R2 si le mode présigné S3 est conservé.

Pour PayDunya, ajoute également `PAYDUNYA_MODE`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` et `PAYDUNYA_STORE_NAME`. La clé publique peut être conservée pour les évolutions futures, mais les appels WebPay actuels restent côté serveur. Définis `PAYDUNYA_CALLBACK_URL` sur `/api/payments/paydunya/ipn` et les URLs de retour/annulation sur le domaine public.

## Test local

```bash
cp .env.example .env.local
npm run typecheck
npm run lint
npm test
npm run dev
```

Sans les secrets des fournisseurs, l’interface utilise le provider démo. Avec Gemini ou Claude mais sans `OPENROUTER_API_KEY`, le plan IA est testé, mais une génération vidéo réelle reste bloquée jusqu’à la configuration d’OpenRouter.

## Mise en production

1. Créer ou sélectionner la base D1 et appliquer la migration.
2. Créer le bucket R2 et configurer CORS pour le domaine Terrova.
3. Configurer le Workflow `terrova-generation` avec la classe `GenerationWorkflow`.
4. Ajouter les variables de `.env.example` dans l’environnement Cloudflare.
5. Ajouter `OPENROUTER_API_KEY`, puis vérifier `OPENROUTER_VIDEO_MODEL=bytedance/seedance-2.0-mini` et `OPENROUTER_VIDEO_RESOLUTION=720p`.
6. Activer une règle lifecycle R2 supprimant le préfixe `temp/` après 24 heures.

## Vérification PayDunya

Commence avec une application PayDunya en mode test et un compte client fictif. Les statuts reçus par IPN sont revalidés avec l'endpoint de confirmation PayDunya avant l'écriture du paiement et l'ajout des crédits. Ne bascule en mode `live` qu'après un paiement sandbox complet, un paiement annulé, un paiement échoué et le rejeu d'une même notification.
