import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prepareVideoPrompt } from "@/src/lib/ai/ai-provider";
import { assertAnySessionOwnsTempKey } from "@/src/lib/storage/r2";
import { generationRequestSchema } from "@/src/lib/validations/generation";
import { getCurrentUser, getUserIdForRequest } from "@/src/lib/supabase/server";
import { verifyGuestSessionCookie } from "@/src/lib/guest-session";
import { getSupabaseConfig } from "@/src/lib/env";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = await getUserIdForRequest(body.sessionId, { allowGuest: true });
    if (!sessionId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const guestSessionId = z.string().uuid().optional().parse(body.guestSessionId);
    const user = await getCurrentUser();
    const guestOwnershipSessionId = guestSessionId ?? (user ? undefined : sessionId);
    if (getSupabaseConfig() && guestOwnershipSessionId && !(await verifyGuestSessionCookie(request, guestOwnershipSessionId))) {
      return NextResponse.json({ error: "Session invitée invalide." }, { status: 401 });
    }

    const input = generationRequestSchema.parse({ ...body, sessionId });
    const ownershipSessions = user && guestSessionId ? [guestSessionId, input.sessionId] : [guestSessionId ?? input.sessionId];
    input.images.forEach((image) => assertAnySessionOwnsTempKey(ownershipSessions, image.key));
    const result = await prepareVideoPrompt(input);

    return NextResponse.json({
      prompt: result.prompt,
      plan: result.plan,
      provider: result.provider,
    });
  } catch (error) {
    const reason = error instanceof ZodError
      ? error.issues.map((issue) => issue.message).join(", ")
      : error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: "Le prompt intelligent n'a pas pu être préparé.", reason },
      { status: 400 },
    );
  }
}
