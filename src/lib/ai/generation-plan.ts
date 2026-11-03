import type { GenerateVideoInput } from "@/src/lib/video/video-provider";
import { z } from "zod";

const inputImageKeySchema = z
  .string()
  .regex(/^temp\/[a-zA-Z0-9-]+\/input\/[a-f0-9-]+\.(jpg|png|webp)$/);

export const generationPlanSchema = z.object({
  version: z.literal(1),
  language: z.literal("fr"),
  title: z.string().min(2).max(120),
  hook: z.string().min(2).max(180),
  scenes: z
    .array(
      z.object({
        index: z.number().int().min(0).max(20),
        imageKey: inputImageKeySchema,
        durationSeconds: z.number().min(1).max(15),
        visualPrompt: z.string().min(10).max(600),
        caption: z.string().min(2).max(140),
        voiceover: z.string().max(360).optional(),
      }),
    )
    .min(1)
    .max(12),
  finalCallToAction: z.string().min(2).max(180),
});

export type GenerationPlan = z.infer<typeof generationPlanSchema>;

export function normalizeGenerationPlan(input: GenerateVideoInput, value: unknown) {
  const plan = generationPlanSchema.parse(value);
  const allowedImageKeys = new Set(input.images.map((image) => image.key));
  if (plan.scenes.some((scene) => !allowedImageKeys.has(scene.imageKey))) {
    throw new Error("Le plan IA référence une image non autorisée.");
  }
  const totalDuration = plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new Error("La durée du plan IA est invalide.");
  }

  const minimumDuration = plan.scenes.length;
  const extraDuration = Math.max(0, input.video.duration - minimumDuration);
  let allocatedDuration = 0;
  const scenes = plan.scenes.map((scene, index) => {
    const isLast = index === plan.scenes.length - 1;
    const durationSeconds = isLast
      ? input.video.duration - allocatedDuration
      : 1 + (scene.durationSeconds / totalDuration) * extraDuration;
    allocatedDuration += durationSeconds;
    return { ...scene, index, durationSeconds };
  });

  return generationPlanSchema.parse({ ...plan, scenes });
}

export const generationPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [1] },
    language: { type: "string", enum: ["fr"] },
    title: { type: "string" },
    hook: { type: "string" },
    scenes: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          imageKey: { type: "string" },
          durationSeconds: { type: "number" },
          visualPrompt: { type: "string" },
          caption: { type: "string" },
          voiceover: { type: "string" },
        },
        required: ["index", "imageKey", "durationSeconds", "visualPrompt", "caption"],
      },
    },
    finalCallToAction: { type: "string" },
  },
  required: ["version", "language", "title", "hook", "scenes", "finalCallToAction"],
} as const;

export function buildGenerationPlanPrompt(input: GenerateVideoInput) {
  const imageKeys = input.images.map((image) => image.key);

  return `Tu es le directeur créatif senior de Terrova, une plateforme française de vidéos immobilières.

Ta mission est de concevoir une visite vidéo crédible, élégante et engageante à partir des photos jointes. Tu dois réellement observer les images : identifie les pièces, leurs connexions, les volumes, la lumière, les matières, les points forts et les limites de chaque photo. Ne te contente pas de reformuler les informations textuelles.

Crée un plan de vidéo en français pour ce bien. Une scène correspond à une photo réellement fournie. Ne fabrique jamais d'information absente et n'utilise jamais une imageKey qui ne figure pas dans la liste autorisée.

Bien :
- Type : ${input.property.type}
- Transaction : ${input.property.transaction}
- Quartier : ${input.property.district ?? "non précisé"}
- Commentaires : ${input.property.comments ?? "aucun"}

Vidéo :
- Style : ${input.video.style}
- Ratio : ${input.video.ratio}
- Durée : ${input.video.duration} secondes
- Plateforme : ${input.video.platform ?? "réseaux sociaux"}
- Consignes du modèle : ${input.video.templateInstructions ?? "aucune"}

ImageKeys autorisées :
${imageKeys.map((key) => `- ${key}`).join("\n")}

Directives de réalisation :
- Organise les photos en une seule visite continue, avec un début accrocheur, une progression naturelle et une conclusion claire.
- Évite les répétitions : si deux photos montrent la même pièce, choisis celle qui raconte le mieux l'espace ou utilise la seconde pour révéler un autre angle.
- Pour chaque scène, décris précisément le sujet visible, le mouvement de caméra réaliste, la transition vers la scène suivante et l'intention émotionnelle.
- Adapte le rythme à la durée totale : un format dynamique peut être plus vif, mais ne doit jamais devenir artificiel ou saccadé.
- Ne déduis pas une pièce, une surface, une orientation, une vue, un équipement, un prix ou une localisation qui ne sont pas visibles ou confirmés.
- Si une pièce est vide, une décoration minimaliste peut être suggérée uniquement comme intention de mise en scène, sans modifier sa configuration. Ne rajoute rien dans les espaces déjà meublés.
- Rédige toutes les valeurs en français naturel. N'ajoute aucune URL et ne mentionne pas ton rôle.

Produis uniquement un JSON conforme au schéma fourni.`;
}

export function buildGenerationPlanReviewPrompt(input: GenerateVideoInput, draft: GenerationPlan) {
  return `Tu es le responsable qualité éditorial et visuel de Terrova. Vérifie le plan de visite ci-dessous en le comparant aux photos jointes et aux informations confirmées.

Corrige directement le plan si nécessaire, puis retourne uniquement un JSON conforme au schéma fourni. Le plan corrigé doit rester une seule visite continue, utiliser exclusivement les imageKey autorisées et respecter la durée totale de ${input.video.duration} secondes.

Contrôle impérativement :
- chaque pièce ou élément décrit doit être réellement visible dans la photo correspondante ;
- aucun prix, nombre de pièces, superficie, vue, adresse, équipement ou caractéristique non confirmé ne doit apparaître ;
- l'ordre de visite doit être fluide et sans répétition inutile ;
- chaque mouvement de caméra doit être réalisable et discret ;
- les légendes et la voix off doivent être courtes, naturelles et fidèles ;
- les scènes doivent couvrir la durée demandée sans dépasser ${input.video.duration} secondes au total.

Informations confirmées : type ${input.property.type}, transaction ${input.property.transaction}, quartier ${input.property.district ?? "non précisé"}, commentaires ${input.property.comments ?? "aucun"}.

Plan à contrôler :
${JSON.stringify(draft)}`;
}

export function createDeterministicGenerationPlan(input: GenerateVideoInput): GenerationPlan {
  const durationPerScene = Math.max(1, input.video.duration / input.images.length);

  return generationPlanSchema.parse({
    version: 1,
    language: "fr",
    title: `${input.property.type}${input.property.district ? ` — ${input.property.district}` : ""}`,
    hook: `${input.property.type} proposé à la ${input.property.transaction.toLowerCase()}`,
    scenes: input.images.map((image, index) => ({
      index,
      imageKey: image.key,
      durationSeconds: durationPerScene,
      visualPrompt: `Mouvement de caméra ${input.video.style} doux et professionnel, mise en valeur fidèle de la pièce et de sa lumière naturelle.`,
      caption: index === 0 ? `${input.property.type} proposé à la ${input.property.transaction.toLowerCase()}.` : `Découvrez ce bien${input.property.district ? ` à ${input.property.district}` : ""}.`,
      voiceover: index === 0 ? `Découvrez ce ${input.property.type.toLowerCase()} proposé à la ${input.property.transaction.toLowerCase()}.` : undefined,
    })),
    finalCallToAction: `${input.property.transaction} — Contactez-nous pour visiter.`,
  });
}

const styleLabels = {
  elegant: "élégant et premium",
  dynamic: "dynamique et rythmé",
  cinematic: "cinématique et immersif",
  minimal: "minimaliste et contemporain",
} as const;

function transactionPhrase(transaction: string) {
  return `à la ${transaction.toLowerCase()}`;
}

export function buildDefaultVideoPrompt(input: GenerateVideoInput) {
  const district = input.property.district ? ` situé dans le quartier ${input.property.district}` : "";
  const comments = input.property.comments?.trim() ? ` Commentaires de l'utilisateur à prendre en compte : ${input.property.comments.trim()}.` : "";
  const templateInstructions = input.video.templateInstructions?.trim()
    ? ` Consignes du modèle à respecter : ${input.video.templateInstructions.trim()}.`
    : "";
  return `Crée une seule vidéo immobilière au style ${styleLabels[input.video.style]} au format ${input.video.ratio}, d'une durée de ${input.video.duration} secondes, à partir des photos fournies. Construis un parcours logique et unique : si plusieurs pièces sont visibles, filme-les une à une dans un ordre naturel avec des transitions très fluides, comme une visite continue du bien. Présente fidèlement ce bien de type ${input.property.type.toLowerCase()}${district}, ${transactionPhrase(input.property.transaction)}.${comments}${templateInstructions} Observe les photos pour identifier les espaces, les volumes, les matières et la lumière. Utilise des mouvements de caméra naturels et professionnels, en conservant une continuité de lumière, d'échelle et de direction. Si une pièce est clairement vide, tu peux proposer une décoration minimaliste, sobre et réaliste, sans masquer sa configuration. N'invente aucune information et n'ajoute aucun élément dans les espaces déjà meublés.`;
}

export function renderGenerationPlanPrompt(input: GenerateVideoInput, plan: GenerationPlan) {
  const style = styleLabels[input.video.style];
  const district = input.property.district ? ` dans le quartier ${input.property.district}` : "";
  const comments = input.property.comments?.trim()
    ? `\nDemandes particulières de l'utilisateur : ${input.property.comments.trim()}`
    : "";
  const templateInstructions = input.video.templateInstructions?.trim()
    ? `\nConsignes du modèle sélectionné : ${input.video.templateInstructions.trim()}`
    : "";
  const imageNumber = new Map(input.images.map((image, index) => [image.key, index + 1]));
  const scenes = plan.scenes.map((scene, index) => {
    const photoNumber = imageNumber.get(scene.imageKey) ?? index + 1;
    const voiceover = scene.voiceover ? ` Voix off : ${scene.voiceover}` : "";
    return `${index + 1}. Photo ${photoNumber} — ${scene.durationSeconds.toFixed(1)} seconde(s). Sujet et mouvement : ${scene.visualPrompt} Légende à afficher : ${scene.caption}.${voiceover}`;
  }).join("\n");

  return `Réalise une seule vidéo immobilière ${style}, au format ${input.video.ratio}, d'une durée totale de ${input.video.duration} secondes, à partir exclusivement des photos fournies.

OBJECTIF
Présenter un bien de type ${input.property.type.toLowerCase()}${district}, proposé à la ${input.property.transaction.toLowerCase()}, comme une visite continue, désirable et fidèle à la réalité. Titre éditorial : ${plan.title}. Accroche : ${plan.hook}.

INFORMATIONS CONFIRMÉES
Type : ${input.property.type}. Transaction : ${input.property.transaction}. Quartier : ${input.property.district ?? "non précisé"}.${comments}${templateInstructions}

DÉROULÉ OBLIGATOIRE
${scenes}

DIRECTION ARTISTIQUE
Maintiens une continuité naturelle de lumière, d'échelle, de perspective et de direction entre les plans. Utilise uniquement des mouvements de caméra réalistes : léger travelling, panoramique lent, approche douce ou recul stabilisé. Les transitions doivent être fluides et discrètes. Mets en valeur les volumes, les ouvertures, les matières et la lumière réellement visibles. N'ajoute aucun meuble, équipement, décor, personne, texte, logo ou élément architectural absent des photos. Ne modifie pas la disposition des espaces. N'invente jamais de superficie, de nombre de pièces, de vue, d'adresse, de prix ou de caractéristique non confirmée.

CONCLUSION
Termine avec cet appel à l'action : ${plan.finalCallToAction}. La vidéo doit rester professionnelle, chaleureuse, lisible et adaptée à une annonce immobilière française.`;
}
