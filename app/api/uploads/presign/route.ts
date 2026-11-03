import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createPresignedUpload } from "@/src/lib/storage/r2";
import { presignUploadSchema } from "@/src/lib/validations/upload";
import { getCurrentUser, getUserIdForRequest } from "@/src/lib/supabase/server";
import { createGuestSessionToken, getVerifiedGuestSessionId, guestSessionCookieName } from "@/src/lib/guest-session";
import { getSupabaseConfig } from "@/src/lib/env";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const user = await getCurrentUser();
    const supabaseConfigured = Boolean(getSupabaseConfig());
    const requestedSessionId = z.string().uuid().safeParse(body.sessionId).data;
    const verifiedGuestSessionId = supabaseConfigured ? await getVerifiedGuestSessionId(request) : null;
    const guestSessionId = requestedSessionId === verifiedGuestSessionId ? verifiedGuestSessionId : null;
    if (supabaseConfigured && !user && !guestSessionId) {
      return NextResponse.json({ error: "Initialisez la session invitée avant l'upload." }, { status: 401 });
    }
    const sessionId = guestSessionId ?? user?.id ?? await getUserIdForRequest(body.sessionId, { allowGuest: true });
    if (!sessionId) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const input = presignUploadSchema.parse({ ...body, sessionId });
    const result = await createPresignedUpload(input);
    const response = NextResponse.json(result);
    if (!user && !guestSessionId) {
      response.cookies.set(guestSessionCookieName, await createGuestSessionToken(sessionId), {
        httpOnly: true,
        maxAge: 60 * 60 * 24,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  } catch (error) {
    const reason =
      error instanceof ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : error instanceof Error
          ? error.message
          : "Erreur inconnue";

    return NextResponse.json(
      {
        error: "Impossible de préparer l'upload. Vérifiez le format et la taille de l'image.",
        reason,
      },
      { status: 400 },
    );
  }
}
