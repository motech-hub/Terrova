# Plan de gestion des crédits et des paiements

## Décision retenue

Terrova adoptera un modèle hybride :

- un abonnement mensuel avec un quota de crédits ou de vidéos inclus ;
- des crédits ou des vidéos supplémentaires achetables à la demande ;
- une offre personnalisée pour les agences et promoteurs à gros volume.

Tous les paiements, quel que soit le prestataire utilisé, alimenteront le même portefeuille de crédits Terrova.

## État d'avancement

Le socle du modèle hybride est en place : plans centralisés, packs définis, portefeuille initial Starter, réservation des crédits au lancement d'une génération, restitution en cas d'échec et affichage du solde dans le tableau de bord. PayDunya WebPay/PAR est maintenant disponible pour les achats ponctuels ; les abonnements récurrents restent désactivés.

## Règle de marge actuelle

Le modèle vidéo testé est `bytedance/seedance-2.0-mini`. Son coût fournisseur est fixé à `0,03024 USD par seconde` en 720p sans audio, et le barème Terrova est fixé à `2 crédits par seconde` :

```text
coût OpenRouter = durée en secondes × 0,03024 USD
crédits Terrova = durée en secondes × 2
```

Exemples : `5 secondes = 0,1512 USD et 10 crédits`, `10 secondes = 0,3024 USD et 20 crédits`, `15 secondes = 0,4536 USD et 30 crédits`. Le coût est calculé localement à partir du modèle configuré ; aucune lecture d'un solde de crédits OpenRouter n'est nécessaire. Cette règle devra être recalibrée avec les frais PayDunya/Stripe, les coûts d'infrastructure et l'évolution éventuelle du tarif fournisseur.

## Parcours invité jusqu'au paiement

L'utilisateur peut ajouter ses photos, renseigner le bien, recevoir l'estimation et modifier le prompt sans créer de compte. L'authentification intervient uniquement lorsqu'il clique pour lancer la génération réelle. Terrova conserve alors le brouillon et ses clés d'images temporaires dans la session du navigateur, redirige vers la connexion, puis reprend automatiquement le lancement.

Si le portefeuille authentifié ne contient pas assez de crédits, Terrova redirige vers le choix d'un pack PayDunya, conserve le brouillon et revient vers la génération après confirmation serveur du paiement. Aucune génération ne démarre avant la réservation des crédits ; les crédits sont consommés uniquement après réussite et libérés en cas d'échec.

## Ordre d'implémentation

Le développement sera réalisé dans cet ordre :

1. Mettre en place le modèle hybride Terrova, sans connecter de moyen de paiement dans un premier temps.
2. Ajouter PayDunya pour les utilisateurs du Sénégal et les pays africains compatibles. Cette étape est implémentée pour les achats ponctuels.
3. Ajouter Stripe pour les cartes internationales et les abonnements lorsque le compte marchand Terrova est éligible.

## Règle de présentation des moyens de paiement

La localisation servira à préselectionner le moyen de paiement, sans bloquer l'utilisateur :

- Sénégal : PayDunya affiché en priorité ;
- pays africain compatible PayDunya : PayDunya affiché en priorité ;
- Europe et autres pays : Stripe affiché en priorité ;
- pays inconnu, VPN ou cas non reconnu : PayDunya et Stripe affichés ;
- l'utilisateur pourra toujours changer son choix.

La détection IP ne sera pas la seule source de vérité. Le pays de facturation et le choix explicite de l'utilisateur seront pris en compte avant de créer la commande.

## Fonctionnement financier cible

```text
Plan ou pack choisi
        ↓
Commande Terrova créée en attente
        ↓
Paiement PayDunya ou Stripe
        ↓
Confirmation serveur par webhook ou callback
        ↓
Crédits ajoutés au portefeuille Terrova
        ↓
Crédits réservés puis débités lors d'une génération
```

Les crédits ne seront jamais ajoutés à partir de la simple page de retour du paiement. La confirmation serveur sera obligatoire et chaque transaction devra être traitée de manière idempotente pour éviter les doublons.

## Étape 1 — Modèle hybride Terrova

À définir avant le développement du paiement :

- les plans Starter, Agence et Promoteur ;
- le nombre de crédits ou de vidéos inclus par plan ;
- le prix des packs supplémentaires ;
- le coût Terrova d'une génération de 10 secondes et de 15 secondes ;
- la règle en cas d'échec ou d'annulation d'une génération ;
- la durée de validité des crédits ;
- la politique de renouvellement et de report des crédits ;
- la marge minimale souhaitée par vente.

## Étape 2 — PayDunya

PayDunya sera prioritaire pour les paiements locaux en XOF et les moyens de paiement mobiles disponibles selon le pays.

Prévoir :

- création d'une facture PayDunya ;
- redirection ou paiement intégré ;
- callback/IPN de confirmation ;
- vérification du statut côté serveur ;
- ajout des crédits après confirmation ;
- gestion des paiements en attente, annulés ou échoués ;
- historique et rapprochement des transactions.

## Étape 3 — Stripe

Stripe sera ajouté pour les paiements internationaux et les abonnements automatiques, sous réserve de l'éligibilité du compte marchand Terrova.

Prévoir :

- Checkout ou Payment Element ;
- paiement ponctuel des packs ;
- abonnement récurrent ;
- webhooks Stripe ;
- gestion des renouvellements, impayés, remboursements et résiliations ;
- ajout ou retrait des crédits selon l'état réel de l'abonnement.

## Architecture technique à conserver

Les deux prestataires devront utiliser les mêmes concepts internes :

- `orders` : commandes et plans achetés ;
- `payments` : transactions PayDunya ou Stripe ;
- `credit_wallets` : solde de crédits par utilisateur ;
- `credit_ledger` : historique immuable des ajouts, réservations, débits et remboursements ;
- `generation_costs` : coût réel et coût Terrova de chaque génération.

Le prestataire de paiement sera interchangeable. La logique métier des crédits ne devra pas dépendre directement de Stripe ou de PayDunya.

## Hors périmètre immédiat

- Ne pas connecter Stripe maintenant.
- Ne pas connecter PayDunya maintenant.
- Ne pas lancer une génération avant de vérifier le solde et de réserver les crédits.
- Ne pas considérer le coût OpenRouter comme les crédits Terrova.
- Ne pas afficher le solde OpenRouter au client final.
