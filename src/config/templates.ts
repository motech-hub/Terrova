import type { VideoDuration, VideoRatio, VideoStyle } from "@/src/lib/video/video-provider";

export const templateImages: Record<string, string> = {
  "villa-premium": "/images/template-villa-premium.png",
  "appartement-moderne": "/images/template-appartement-moderne.png",
  "location-airbnb": "/images/template-location-airbnb.png",
  "visite-rapide": "/images/template-visite-rapide.png",
  luxe: "/images/template-luxe.png",
  "terrain-projet": "/images/template-terrain-projet.png",
};

export type VideoTemplate = {
  id: string;
  name: string;
  description: string;
  style: VideoStyle;
  duration: VideoDuration;
  ratio: VideoRatio;
  instructions: string;
};

export const templates: VideoTemplate[] = [
  {
    id: "villa-premium",
    name: "Villa Premium",
    description: "Présentation élégante pour maisons haut de gamme.",
    style: "cinematic",
    duration: 15,
    ratio: "9:16",
    instructions: "Mettre en avant les volumes, la lumière, les extérieurs et les finitions.",
  },
  {
    id: "appartement-moderne",
    name: "Appartement moderne",
    description: "Visite claire pour appartements urbains.",
    style: "elegant",
    duration: 10,
    ratio: "16:9",
    instructions: "Créer une visite fluide pièce par pièce avec transitions sobres.",
  },
  {
    id: "location-airbnb",
    name: "Location Airbnb",
    description: "Rendu chaleureux pour convaincre rapidement.",
    style: "dynamic",
    duration: 10,
    ratio: "9:16",
    instructions: "Insister sur le confort, l'emplacement et les détails accueillants.",
  },
  {
    id: "visite-rapide",
    name: "Visite rapide",
    description: "Format court pour réseaux sociaux.",
    style: "dynamic",
    duration: 5,
    ratio: "9:16",
    instructions: "Montrer les meilleurs angles immédiatement avec rythme énergique.",
  },
  {
    id: "luxe",
    name: "Immobilier de luxe",
    description: "Ambiance premium et cinématique.",
    style: "cinematic",
    duration: 15,
    ratio: "16:9",
    instructions: "Utiliser un ton haut de gamme, calme, avec mise en valeur des détails.",
  },
  {
    id: "terrain-projet",
    name: "Terrain / Projet immobilier",
    description: "Idéal pour terrains et programmes neufs.",
    style: "minimal",
    duration: 10,
    ratio: "1:1",
    instructions: "Expliquer le potentiel, l'accès, la zone et la projection d'usage.",
  },
];
