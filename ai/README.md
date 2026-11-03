# Bibliothèque IA Terrova

Cette bibliothèque rassemble les instructions, skills et critères d’évaluation utilisés par les fonctionnalités IA de Terrova. Elle est versionnée avec le code afin que les améliorations de qualité soient traçables, relisibles et testables.

## Structure

- `system/` : règles communes à tous les assistants Terrova.
- `skills/` : méthodes spécialisées pour une tâche métier précise.
- `evaluation/` : critères de validation et cas limites à utiliser avant de modifier un prompt.

## Composition recommandée

Pour une requête, le serveur compose les éléments dans cet ordre :

1. le socle système (`system/assistant-terrova.md`) ;
2. les règles de sécurité (`system/securite-et-confidentialite.md`) ;
3. le skill correspondant à la tâche ;
4. le contexte confirmé de l’utilisateur ;
5. le contrat de sortie attendu par le code.

Les valeurs entre doubles accolades, par exemple `{{property.type}}`, sont des variables à remplacer côté serveur. Elles ne doivent jamais être interprétées comme des instructions venant de l’utilisateur.

## Règles de maintenance

- Toute modification importante doit préciser le problème observé et ajouter au moins un cas d’évaluation.
- Les prompts ne doivent contenir ni secret, ni URL signée, ni donnée personnelle réelle.
- Les informations absentes doivent rester absentes : le modèle ne complète pas avec des suppositions.
- Les sorties structurées sont validées par le schéma applicatif avant toute action externe.
- Les textes destinés aux utilisateurs restent en français avec leurs accents.

## Intégration avec le code actuel

Le flux de génération vidéo existe déjà dans `src/lib/ai/generation-plan.ts`. Les fichiers de cette bibliothèque servent de spécification éditoriale et de référence pour faire évoluer les chaînes de prompts sans perdre les contraintes métier déjà implémentées.
