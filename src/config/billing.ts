export const billingPlans = [
  {
    id: "starter",
    name: "Starter",
    priceXof: 15_000,
    priceLabel: "15 000 FCFA",
    credits: 120,
    description: "Pour commencer à valoriser vos premiers biens.",
    cta: "Commencer",
  },
  {
    id: "agency",
    name: "Agence",
    priceXof: 49_000,
    priceLabel: "49 000 FCFA",
    credits: 500,
    description: "Pour les agences qui publient régulièrement.",
    cta: "Choisir Agence",
  },
  {
    id: "promoter",
    name: "Promoteur",
    priceXof: null,
    priceLabel: "Sur mesure",
    credits: null,
    description: "Pour les volumes élevés et les équipes.",
    cta: "Nous contacter",
  },
] as const;

export const creditPacks = [
  {
    id: "pack-test-10",
    name: "Pack test",
    priceXof: 100,
    priceLabel: "100 FCFA",
    credits: 10,
    description: "Offre temporaire pour tester un paiement PayDunya en production.",
  },
  { id: "pack-60", name: "Pack 60", priceXof: 5_000, priceLabel: "5 000 FCFA", credits: 60 },
  { id: "pack-200", name: "Pack 200", priceXof: 10_000, priceLabel: "10 000 FCFA", credits: 200 },
] as const;

// Tarifs fournisseur et barème commercial des modèles vidéo actuellement configurés.
// Le test actif utilise Seedance 2.0 Mini à 0,03024 USD par seconde en 720p sans audio.
export const openRouterVideoPricing = {
  "minimax/hailuo-3-max": {
    providerCostPerSecondUsd: 0.05,
    terrovaCreditsPerSecond: 2,
  },
  "bytedance/seedance-2.0-mini": {
    providerCostPerSecondUsd: 0.03024,
    terrovaCreditsPerSecond: 2,
  },
} as const;

export function getOpenRouterVideoPricing(modelId: string) {
  const pricing = openRouterVideoPricing[modelId as keyof typeof openRouterVideoPricing];
  if (!pricing) throw new Error(`Aucun tarif Terrova n'est configuré pour le modèle OpenRouter « ${modelId} ».`);
  return pricing;
}

export function calculateTerrovaCredits(durationSeconds: number, creditsPerSecond: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(creditsPerSecond) || creditsPerSecond <= 0) {
    throw new Error("La durée et le tarif en crédits par seconde sont requis pour calculer les crédits Terrova.");
  }
  return Math.max(1, Math.ceil(durationSeconds * creditsPerSecond));
}

export const defaultBillingPlan = billingPlans[0];

export type PurchasableProduct = {
  productType: "plan" | "pack";
  productId: string;
  name: string;
  description: string;
  priceXof: number;
  credits: number;
};

export function getPurchasableProduct(productType: "plan" | "pack", productId: string): PurchasableProduct | null {
  if (productType === "plan") {
    const plan = billingPlans.find((candidate) => candidate.id === productId);
    if (!plan || plan.priceXof === null || plan.credits === null) return null;
    return {
      productType,
      productId: plan.id,
      name: plan.name,
      description: plan.description,
      priceXof: plan.priceXof,
      credits: plan.credits,
    };
  }

  const pack = creditPacks.find((candidate) => candidate.id === productId);
  if (!pack) return null;
  return {
    productType,
    productId: pack.id,
    name: pack.name,
    description: "description" in pack ? pack.description : `Pack de ${pack.credits} crédits Terrova.`,
    priceXof: pack.priceXof,
    credits: pack.credits,
  };
}
