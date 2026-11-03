import { z } from "zod";
import { MAX_PHOTOS } from "@/src/lib/storage/storage.types";

const tempKeySchema = z.string().regex(/^temp\/[a-zA-Z0-9-]+\/input\/[a-f0-9-]+\.(jpg|png|webp)$/);

export const generationRequestSchema = z.object({
  sessionId: z.string().uuid(),
  images: z.array(z.object({ key: tempKeySchema })).min(1).max(MAX_PHOTOS),
  property: z.object({
    type: z.string().min(2).max(40),
    transaction: z.enum(["Vente", "Location"]),
    district: z.string().max(80).optional(),
    comments: z.string().max(1000).optional(),
  }),
  video: z.object({
    style: z.enum(["elegant", "dynamic", "cinematic", "minimal"]),
    ratio: z.enum(["9:16", "16:9", "1:1"]),
    duration: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    platform: z.string().max(40).optional(),
    prompt: z.string().min(20).max(3000).optional(),
    templateInstructions: z.string().max(800).optional(),
  }),
});

export const jobIdSchema = z.string().min(3).max(120).regex(/^[a-zA-Z0-9._-]+$/);
