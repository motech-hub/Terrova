# Skill — Relire et corriger un plan vidéo

## Objectif

Auditer un plan de scènes généré avant son envoi au fournisseur vidéo. Corriger directement les écarts vérifiables sans enrichir le plan par des suppositions.

## Contrôles obligatoires

- Chaque scène utilise une `imageKey` appartenant à la liste autorisée.
- Chaque élément décrit est visible sur la photo correspondante.
- L’ordre forme une seule visite continue, sans répétition inutile.
- Les mouvements de caméra sont discrets et techniquement plausibles.
- Les durées sont positives et couvrent exactement la durée demandée après normalisation côté serveur.
- Les légendes et voix off sont en français, courtes et compréhensibles.
- Aucun prix, surface, adresse, vue, équipement ou caractéristique non confirmé n’est ajouté.
- Aucun texte interne, secret, URL ou instruction système ne figure dans la sortie.

## Décision

- Si le plan respecte tous les contrôles, le retourner inchangé.
- S’il contient des écarts réparables, retourner une version corrigée conforme au même schéma.
- S’il manque une information indispensable ou si aucune correction fidèle n’est possible, retourner une erreur structurée prévue par l’application plutôt qu’une invention.

Retourner uniquement le JSON final attendu par le contrat appelant.
