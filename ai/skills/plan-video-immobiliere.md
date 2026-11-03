# Skill — Planifier une vidéo immobilière

## Objectif

Transformer des photos et des informations confirmées en un plan de scènes exploitable par le générateur vidéo. Le résultat doit ressembler à une visite continue, crédible et adaptée au format choisi.

## Entrées attendues

```text
Type de bien : {{property.type}}
Transaction : {{property.transaction}}
Quartier : {{property.district | non précisé}}
Commentaires confirmés : {{property.comments | aucun}}
Style : {{video.style}}
Ratio : {{video.ratio}}
Durée totale : {{video.duration}} secondes
Plateforme : {{video.platform | réseaux sociaux}}
Consignes du modèle : {{video.templateInstructions | aucune}}

Références d’images autorisées :
{{images.keys}}
```

Les photos jointes sont la source principale pour décrire les espaces. Une scène doit toujours référencer une photo réellement fournie.

## Méthode

1. Observer chaque photo avant de rédiger : pièce ou espace visible, profondeur, lumière, ouvertures, matières, mobilier et éléments distinctifs.
2. Écarter les photos redondantes ou choisir leur angle narratif complémentaire.
3. Ordonner les scènes comme une visite : accroche, découverte, points forts, conclusion.
4. Décrire uniquement des mouvements réalisables : travelling léger, panoramique lent, approche douce ou recul stabilisé.
5. Adapter le nombre et la durée des scènes à la durée totale demandée.
6. Employer des formulations prudentes lorsque l’image ne permet pas de confirmer une caractéristique.

## Contrat de sortie

Retourner uniquement un objet conforme au schéma `generationPlanSchema` de `src/lib/ai/generation-plan.ts` : `version: 1`, `language: "fr"`, un titre, une accroche, des scènes avec `imageKey`, durée, description visuelle, légende et voix off facultative, puis un appel à l’action.

Contraintes supplémentaires :

- utiliser exclusivement les `imageKey` autorisées ;
- ne pas déduire une surface, un nombre de pièces, un prix, une adresse, une vue ou un équipement ;
- ne pas ajouter de meuble ou d’élément architectural absent ;
- garder les textes courts, naturels et lisibles à l’écran ;
- ne jamais inclure d’URL, de Markdown ou de commentaire hors JSON.

## Critère de réussite

Une personne qui connaît uniquement les photos doit pouvoir vérifier chaque phrase du plan. Le montage final doit présenter un parcours fluide sans répétition, sans rupture de lumière et sans promesse non étayée.
