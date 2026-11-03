---
version: alpha
colors:
  background: "#faf9f5"
  surface: "#ffffff"
  surface-secondary: "#f4f3ed"
  primary: "#185c37"
  primary-hover: "#114b2c"
  primary-soft: "#e9f2ec"
  text-primary: "#111713"
  text-secondary: "#626963"
  border: "#e7e5de"
  success: "#25864a"
typography:
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
    fontSize: "1rem"
    lineHeight: "1.5"
  utility:
    fontFamily: "Geist Mono, monospace"
rounded:
  control: "0.85rem"
  card: "1rem"
  pill: "999px"
components:
  primary-button:
    background: "var(--primary)"
    radius: "0.85rem"
  card:
    background: "var(--surface)"
    border: "var(--border)"
    radius: "1rem"
---

## Overview

Terrova est un outil produit pour les professionnels de l’immobilier. L’interface doit évoquer un studio de production calme : les photos du bien restent au centre, les choix sont réduits et chaque étape donne une décision claire avant la génération.

Le parcours de création est une surface produit, pas une page marketing. Sa signature est le passage des photos à un prompt final lisible et éditable, comme une fiche de réalisation que l’utilisateur peut valider.

## Colors

Le vert profond porte les actions et la confiance. Les surfaces ivoire et blanches laissent respirer les aperçus photo. Les couleurs sémantiques restent réservées aux états de succès, d’avertissement et d’erreur.

## Typography

Geist est la police de l’application. Les titres utilisent une graisse forte et une mesure courte ; les textes d’aide restent sobres et lisibles. Les libellés sont en français, avec les accents corrects.

## Layout

Le wizard conserve une structure en étapes, avec une carte principale et des actions stables en bas. Les formulaires passent d’une colonne à deux colonnes sur écran moyen. La dernière étape privilégie une grande zone de texte pour le prompt et une colonne de réglages compacte.

## Elevation & Depth

Les cartes utilisent une ombre douce uniquement pour séparer les surfaces de travail du fond. Les contrôles sélectionnés sont signalés d’abord par une bordure et un anneau internes, jamais par la couleur seule.

## Shapes

Les cartes et contrôles ont des angles arrondis généreux, sans effet “bulle” excessif. Les badges d’état et les indicateurs d’étape utilisent une forme pilule ou circulaire quand leur contenu est court.

## Components

Les boutons primaires utilisent `--primary`, les boutons secondaires une surface blanche et `--border`. Les champs ont un vrai label visible, un espace réservé à l’aide et une zone de saisie stable. Les aperçus d’images conservent leur ratio et leurs actions restent accessibles au clavier.

## Do's and Don'ts

- Montrer ce que l’IA propose et laisser l’utilisateur le corriger.
- Garder les paramètres vidéo simples, avec une valeur par défaut utile.
- Ne pas demander la ville si elle n’est pas nécessaire au prompt.
- Ne pas présenter comme certain un détail que les photos ne permettent pas de vérifier.
- Ne pas cacher le prompt réel derrière une étape technique invisible.
