import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prepareVideoPrompt } from "@/src/lib/ai/ai-provider";
import { InsufficientCreditsError, releaseReservedCredits, reserveCredits } from "@/src/lib/credits/credit-store";
import { findGenerationByInput, saveGenerationJob } from "@/src/lib/generations/generation-store";
import { assertAnySessionOwnsTempKey } from "@/src/lib/storage/r2";
import { videoProvider } from "@/src/lib/video/openrouter-video-provider";
import { startGenerationWorkflow } from "@/src/lib/workflows/workflow-client";
import { generationRequestSchema } from "@/src/lib/validations/generation";
import { getCurrentUser, getUserIdForRequest } from "@/src/lib/supabase/server";
import { verifyGuestSessionCookie } from "@/src/lib/guest-session";
import { getSupabaseConfig } from "@/src/lib/env";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = await getUserIdForRequest(body.sessionId);
    if (!sessionId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const guestSessionId = z.string().uuid().optional().parse(body.guestSessionId);
    const user = await getCurrentUser();
    if (getSupabaseConfig() && user && guestSessionId && !(await verifyGuestSessionCookie(request, guestSessionId))) {
      throw new Error("La session invitée n'est pas liée à ce navigateur.");
    }
    const parsedInput = generationRequestSchema.parse({ ...body, sessionId });
    const ownershipSessions = user && guestSessionId ? [guestSessionId, parsedInput.sessionId] : [guestSessionId ?? parsedInput.sessionId];
    parsedInput.images.forEach((image) => assertAnySessionOwnsTempKey(ownershipSessions, image.key));
    const input = parsedInput.video.prompt?.trim()
      ? parsedInput
      : {
          ...parsedInput,
          video: {
            ...parsedInput.video,
            prompt: (await prepareVideoPrompt(parsedInput)).prompt,
          },
        };
    const existing = await findGenerationByInput(input);
    if (existing && !["completed", "failed"].includes(existing.status)) {
      return NextResponse.json(
        { jobId: existing.jobId, status: existing.status, provider: existing.provider },
        { status: 202 },
      );
    }

    const estimate = await videoProvider.estimate(input);
    if (!estimate.terrovaCredits || estimate.terrovaCredits <= 0) {
      throw new Error("Le tarif du modèle vidéo est requis pour lancer la génération.");
    }
    const creditCost = estimate.terrovaCredits;
    const creditReservationId = `generation:${crypto.randomUUID()}`;
    await reserveCredits(input.sessionId, creditCost, creditReservationId);

    let result;
    try {
      result = await videoProvider.generate(input);
      result = { ...result, creditCost, creditReservationId };
      await saveGenerationJob(input, result);
    } catch (error) {
      await releaseReservedCredits(input.sessionId, creditCost, creditReservationId);
      throw error;
    }
    await startGenerationWorkflow(result.jobId);
    return NextResponse.json({ ...result, creditCost }, { status: 202 });
  } catch (error) {
    const reason =
      error instanceof ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Erreur inconnue";

    console.error("[Generation] Start failed", {
      errorName: error instanceof Error ? error.name : typeof error,
      reason: reason.slice(0, 500),
    });

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: error.message, balance: error.balance, required: error.required },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        error: "La génération n'a pas pu démarrer. Réessayez dans un instant.",
        reason,
      },
      { status: 400 },
    );
  }
}
