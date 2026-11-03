import { z } from "zod";

export const sessionIdSchema = z.string().uuid();

export const paymentProductSchema = z.object({
  productType: z.enum(["plan", "pack"]),
  productId: z.string().trim().min(1).max(64),
  sessionId: sessionIdSchema.optional(),
  returnTo: z.string().regex(/^\/(?!\/)/).max(300).refine((value) => !value.includes("\\") && !Array.from(value).some((character) => character.charCodeAt(0) < 32), "Le chemin de retour est invalide.").optional(),
});
