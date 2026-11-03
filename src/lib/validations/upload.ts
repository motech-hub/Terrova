import { z } from "zod";
import { MAX_IMAGE_SIZE_BYTES, SUPPORTED_IMAGE_TYPES } from "@/src/lib/storage/storage.types";

export const presignUploadSchema = z.object({
  sessionId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  contentType: z.enum(SUPPORTED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
});
